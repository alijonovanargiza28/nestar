import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

import moment = require("moment");

import { Properties, Property } from "../../libs/dto/property/property";

import {
  AgentPropertiesInquiry,
  AllPropertiesInquiry,
  PropertiesInquiry,
  PropertyInput,
} from "../../libs/dto/property/property.input";

import { PropertyUpdate } from "../../libs/dto/property/property.update";

import { Direction, Message } from "../../libs/enums/common.enum";

import { PropertyStatus } from "../../libs/enums/property.enum";

import { ViewGroup } from "../../libs/enums/view.enum";

import { StatisticModifier, T } from "../../libs/types/common";

import { lookupMember, shapeIntoMongoObjectId } from "../../libs/config";

import { MemberService } from "../member/member.service";
import { ViewService } from "../view/view.service";

import { LikeInput } from "../../libs/dto/like/like.input";
import { LikeGroup } from "../../libs/enums/like.enum";
import { LikeService } from "../like/like.service";

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel("Property")
    private readonly propertyModel: Model<Property>,

    private readonly memberService: MemberService,

    private readonly viewService: ViewService,

    private readonly likeService: LikeService,
  ) {}

  /**=========================== createProperty =============================**/

  public async createProperty(input: PropertyInput): Promise<Property> {
    try {
      const result = await this.propertyModel.create(input);

      await this.memberService.memberStatusEditor({
        _id: shapeIntoMongoObjectId(result.memberId),
        targetKey: "memberProperties",
        modifier: 1,
      });

      return result;
    } catch (err) {
      console.log(
        "Error, Service.model:",
        err instanceof Error ? err.message : err,
      );

      throw new BadRequestException(Message.CREATE_FAILED);
    }
  }

  /**=========================== getProperty =============================**/

  public async getProperty(
    memberId: Types.ObjectId,
    propertyId: Types.ObjectId,
  ): Promise<Property> {
    const search: T = {
      _id: propertyId,
      propertyStatus: PropertyStatus.ACTIVE,
    };

    const targetProperty = await this.propertyModel
      .findOne(search)
      .lean()
      .exec();

    if (!targetProperty) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    if (memberId) {
      const viewInput = {
        memberId,
        viewRefId: propertyId,
        viewGroup: ViewGroup.PROPERTY,
      };

      const newView = await this.viewService.recordView(viewInput);

      if (newView) {
        await this.propertyStatsEditor({
          _id: propertyId,
          targetKey: "propertyViews",
          modifier: 1,
        });

        targetProperty.propertyViews++;
      }

      const likeInput: LikeInput = {
        memberId,
        likeRefId: propertyId,
        likeGroup: LikeGroup.PROPERTY,
      };

      targetProperty.meLiked =
        await this.likeService.checkLikeExistence(likeInput);
    }

    targetProperty.memberData = await this.memberService.getMember(
      null,
      shapeIntoMongoObjectId(targetProperty.memberId),
    );

    return targetProperty;
  }

  /**=========================== updateProperty =============================**/

  public async updateProperty(
    memberId: Types.ObjectId,
    input: PropertyUpdate,
  ): Promise<Property> {
    let { propertyStatus, soldAt, deletedAt } = input;

    const propertyId = shapeIntoMongoObjectId(input._id);

    const search: T = {
      _id: propertyId,
      memberId,
      propertyStatus: PropertyStatus.ACTIVE,
    };

    if (propertyStatus === PropertyStatus.SOLD) {
      soldAt = moment().toDate();
    } else if (propertyStatus === PropertyStatus.DELETE) {
      deletedAt = moment().toDate();
    }

    const updateData: T = {
      ...input,
      _id: propertyId,
      soldAt,
      deletedAt,
    };

    const result = await this.propertyModel
      .findOneAndUpdate(search, updateData, {
        new: true,
      })
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    if (soldAt || deletedAt) {
      await this.memberService.memberStatusEditor({
        _id: memberId,
        targetKey: "memberProperties",
        modifier: -1,
      });
    }

    return result;
  }

  /**=========================== getProperties =============================**/

  public async getProperties(
    memberId: Types.ObjectId,
    input: PropertiesInquiry,
  ): Promise<Properties> {
    const match: T = {
      propertyStatus: PropertyStatus.ACTIVE,
    };

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    this.shapeMatchQuery(match, input);

    console.log("match:", match);

    const result = await this.propertyModel
      .aggregate([
        {
          $match: match,
        },

        {
          $sort: sort,
        },

        {
          $facet: {
            list: [
              {
                $skip: (input.page - 1) * input.limit,
              },

              {
                $limit: input.limit,
              },

              lookupMember,

              {
                $unwind: "$memberData",
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

    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  /**=========================== shapeMatchQuery =============================**/

  private shapeMatchQuery(match: T, input: PropertiesInquiry): void {
    const {
      memberId,
      locationList,
      roomList,
      bedsList,
      typeList,
      periodsRange,
      pricesRange,
      squaresRange,
      options,
      text,
    } = input.search;

    if (memberId) {
      match.memberId = shapeIntoMongoObjectId(memberId);
    }

    if (locationList?.length) {
      match.propertyLocation = {
        $in: locationList,
      };
    }

    if (roomList?.length) {
      match.propertyRooms = {
        $in: roomList,
      };
    }

    if (bedsList?.length) {
      match.propertyBeds = {
        $in: bedsList,
      };
    }

    if (typeList?.length) {
      match.propertyType = {
        $in: typeList,
      };
    }

    if (pricesRange) {
      match.propertyPrice = {
        $gte: pricesRange.start,
        $lte: pricesRange.end,
      };
    }

    if (periodsRange) {
      match.createdAt = {
        $gte: periodsRange.start,
        $lte: periodsRange.end,
      };
    }

    if (squaresRange) {
      match.propertySquare = {
        $gte: squaresRange.start,
        $lte: squaresRange.end,
      };
    }

    if (text) {
      match.propertyTitle = {
        $regex: new RegExp(text, "i"),
      };
    }

    if (options?.length) {
      match["$or"] = options.map((element) => ({
        [element]: true,
      }));
    }
  }

  /**=========================== getAgentProperties =============================**/

  public async getAgentProperties(
    memberId: Types.ObjectId,
    input: AgentPropertiesInquiry,
  ): Promise<Properties> {
    const { propertyStatus } = input.search;

    if (propertyStatus === PropertyStatus.DELETE) {
      throw new BadRequestException(Message.NO_DATA_FOUND);
    }

    const match: T = {
      memberId,

      propertyStatus: propertyStatus ?? {
        $ne: PropertyStatus.DELETE,
      },
    };

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    const result = await this.propertyModel
      .aggregate([
        {
          $match: match,
        },

        {
          $sort: sort,
        },

        {
          $facet: {
            list: [
              {
                $skip: (input.page - 1) * input.limit,
              },

              {
                $limit: input.limit,
              },

              lookupMember,

              {
                $unwind: "$memberData",
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

    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  /**=========================== likeTargetProperty =============================**/

  public async likeTargetProperty(
    memberId: Types.ObjectId,
    likeRefId: Types.ObjectId,
  ): Promise<Property> {
    const target = await this.propertyModel
      .findOne({
        _id: likeRefId,
        propertyStatus: PropertyStatus.ACTIVE,
      })
      .exec();

    if (!target) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    const input: LikeInput = {
      memberId,
      likeRefId,
      likeGroup: LikeGroup.PROPERTY,
    };

    const modifier: number = await this.likeService.toggleLike(input);

    const result = await this.propertyStatsEditor({
      _id: likeRefId,
      targetKey: "propertyLikes",
      modifier,
    });

    if (!result) {
      throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
    }

    return result;
  }

  /**=========================== getAllPropertiesByAdmin =============================**/

  public async getAllPropertiesByAdmin(
    input: AllPropertiesInquiry,
  ): Promise<Properties> {
    const { propertyStatus, propertyLocationList } = input.search;

    const match: T = {};

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    if (propertyStatus) {
      match.propertyStatus = propertyStatus;
    }

    if (propertyLocationList?.length) {
      match.propertyLocation = {
        $in: propertyLocationList,
      };
    }

    const result = await this.propertyModel
      .aggregate([
        {
          $match: match,
        },

        {
          $sort: sort,
        },

        {
          $facet: {
            list: [
              {
                $skip: (input.page - 1) * input.limit,
              },

              {
                $limit: input.limit,
              },

              lookupMember,

              {
                $unwind: "$memberData",
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

    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  /**=========================== updatePropertyByAdmin =============================**/

  public async updatePropertyByAdmin(input: PropertyUpdate): Promise<Property> {
    let { propertyStatus, soldAt, deletedAt } = input;

    const propertyId = shapeIntoMongoObjectId(input._id);

    const search: T = {
      _id: propertyId,
      propertyStatus: PropertyStatus.ACTIVE,
    };

    if (propertyStatus === PropertyStatus.SOLD) {
      soldAt = moment().toDate();
    } else if (propertyStatus === PropertyStatus.DELETE) {
      deletedAt = moment().toDate();
    }

    const updateData: T = {
      ...input,
      _id: propertyId,
      soldAt,
      deletedAt,
    };

    const result = await this.propertyModel
      .findOneAndUpdate(search, updateData, {
        new: true,
      })
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    if (soldAt || deletedAt) {
      await this.memberService.memberStatusEditor({
        _id: shapeIntoMongoObjectId(result.memberId),
        targetKey: "memberProperties",
        modifier: -1,
      });
    }

    return result;
  }

  /**=========================== removePropertyByAdmin =============================**/

  public async removePropertyByAdmin(
    propertyId: Types.ObjectId,
  ): Promise<Property> {
    const search: T = {
      _id: propertyId,
      propertyStatus: PropertyStatus.DELETE,
    };

    const result = await this.propertyModel.findOneAndDelete(search).exec();

    if (!result) {
      throw new InternalServerErrorException(Message.REMOVE_FAILED);
    }

    return result;
  }

  /**=========================== propertyStatsEditor =============================**/

  public async propertyStatsEditor(
    input: StatisticModifier,
  ): Promise<Property> {
    const { _id, targetKey, modifier } = input;

    const result = await this.propertyModel
      .findByIdAndUpdate(
        _id,
        {
          $inc: {
            [targetKey]: modifier,
          },
        },
        {
          new: true,
        },
      )
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result;
  }
}
