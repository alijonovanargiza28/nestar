import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Like, MeLiked } from "../../libs/dto/like/like";
import { Model, Types } from "mongoose";
import { LikeInput } from "../../libs/dto/like/like.input";
import { Message } from "../../libs/enums/common.enum";
import { T } from "../../libs/types/common";
import { OrdinaryInquiry } from "../../libs/dto/property/property.input";
import { Properties } from "../../libs/dto/property/property";
import { LikeGroup } from "../../libs/enums/like.enum";
import { lookupFavorite } from "../../libs/config";

@Injectable()
export class LikeService {
  constructor(
    @InjectModel("like")
    private readonly likeModel: Model<Like>,
  ) {}

  public async toggleLike(input: LikeInput): Promise<number> {
    const search: T = {
      memberId: input.memberId,
      likeRefId: input.likeRefId,
    };

    const exist = await this.likeModel.findOne(search).exec();

    let modifier = 1;

    if (exist) {
      await this.likeModel.findByIdAndDelete(exist._id).exec();

      modifier = -1;
    } else {
      try {
        await this.likeModel.create(input);
      } catch (err) {
        console.log(
          "Error, Service.model:",
          err instanceof Error ? err.message : err,
        );

        throw new BadRequestException(Message.CREATE_FAILED);
      }
    }

    console.log(`-Like modifier ${modifier}-`);

    return modifier;
  }

  public async checkLikeExistence(input: LikeInput): Promise<MeLiked[]> {
    const { memberId, likeRefId } = input;

    const result = await this.likeModel
      .findOne({
        memberId: memberId,
        likeRefId: likeRefId,
      })
      .exec();

    return result
      ? [
          {
            memberId: memberId,
            likeRefId: likeRefId,
            myFavorite: true,
          },
        ]
      : [];
  }

  public async getFavoriteProperties(
    //Ma'lum bir member tomonidan favorite qilingan property'larni olib kelish.
    memberId: Types.ObjectId,
    //Bu kimning favorite property'larini qidirayotganimizni bildiradi. Ali qaysi property'larni favorite qilgan?
    input: OrdinaryInquiry,
  ): Promise<Properties> {
    const { page, limit } = input;

    const match: T = {
      likeGroup: LikeGroup.PROPERTY,// faqat property bolishi kerak
      memberId: memberId,//aynan shu odamni like bolishi kerak
    };

    const data: T = await this.likeModel
      .aggregate([
        {
          $match: match, //Faqat shu memberning property like'larini ol.
        },
        {
          $sort: {
            updatedAt: -1, //-1 → yangi ma'lumot birinchi.
          },
        },
        {
          $lookup: {
            from: "properties",
            localField: "likeRefId",
            foreignField: "_id",
            as: "favoriteProperty",
          },
        },
        {
          $unwind: "$favoriteProperty", //$unwind uni oddiy object qiladi:
        },
        {
          $facet: {
            list: [
              {
                $skip: (page - 1) * limit,
              },
              {
                $limit: limit,
              },
              lookupFavorite, //U property'ga favorite qilgan member haqida ma'lumot qo'shadi.
              {
                $unwind: "$favoriteProperty.memberData",
              },
            ],
            metaCounter: [
              {
                $count: "total",
              },
            ],
          },
        },
      ])
      .exec();

    console.log("data", data);

    const result: Properties = {
      list: [],
      metaCounter: data[0].metaCounter,
    };

    console.log("result", result);

    result.list = data[0].list.map((ele) => ele.favoriteProperty);

    return result;
  }
}
