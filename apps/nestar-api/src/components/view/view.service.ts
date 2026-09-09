import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { View } from '../../libs/dto/view/view';
import {ViewInput} from '../../libs/dto/view/view.input'
import { T } from '../../libs/types/common';
import { OrdinaryInquiry } from '../../libs/dto/property/property.input';
import { LikeGroup } from '../../libs/enums/like.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { lookupVisit } from '../../libs/config';
import { Properties } from '../../libs/dto/property/property';

@Injectable()
export class ViewService {
  constructor(@InjectModel("View") private readonly viewModel: Model<View>) {}

  public async recordView(input: ViewInput): Promise<View | null> {
    const viewExist = await this.checkViewExistence(input);
    if (!viewExist) {
      console.log("-- New view Insert --");
      return await this.viewModel.create(input);
    } else return null;
  }
  private async checkViewExistence(input: ViewInput): Promise<View | null> {
    const { memberId, viewRefId } = input;
    const search: T = { memberId: memberId, viewRefId: viewRefId };
    return await this.viewModel.findOne(search).exec();
  }
  // memberId→ qaysi member property ko‘rganini aniqlaymiz.
  public async getVisitedProperties(
    memberId: Types.ObjectId,
    input: OrdinaryInquiry,
  ): Promise<Properties> {
    const { page, limit } = input;
    const match: T = { viewGroup: ViewGroup.PROPERTY, memberId: memberId };
    //Shu member tomonidan PROPERTY ko‘rilgan view'larni top.

    const data: T = await this.viewModel
      .aggregate([
        { $match: match },
        { $sort: { updatedAt: -1 } },
        {
          $lookup: {
            from: "properties",
            localField: "viewRefId",
            foreignField: "_id",
            as: "visitedProperty",
          },
        },
        { $unwind: "$visitedProperty" },
        {
          $facet: {
            list: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              lookupVisit, //Bu helper property'ga memberData qo‘shadi.
              //Property kimga tegishli ekanini olish uchun ishlatiladi.
              { $unwind: "$visitedProperty.memberData" },
            ],
            metaCounter: [{ $count: "total" }],
          },
        },
      ])
      .exec();
    console.log("data", data);
    const result: Properties = { list: [], metaCounter: data[0].metaCounter };
    console.log("result", result);
    result.list = data[0].list.map((ele) => ele.visitedProperty);
    return result;
  }
}
