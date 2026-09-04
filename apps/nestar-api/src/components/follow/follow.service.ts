import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  Follower,
  Following,
  Followers,
  Followings,
} from "../../libs/dto/follow/follow";
import { MemberService } from "../member/member.service";
import { Model, Types } from "mongoose";
import { Direction, Message } from "../../libs/enums/common.enum";
import { FollowInquiry } from "../../libs/dto/follow/follow.input";
import { lookupFollowingData, lookupFollowerData } from "../../libs/config";

@Injectable()
export class FollowService {
  constructor(
    @InjectModel("Follow")
    private readonly followModel: Model<Follower | Following>,
    private readonly memberService: MemberService,
  ) {}

  public async subscribe(
    followerId: Types.ObjectId,
    followingId: Types.ObjectId,
  ): Promise<Follower> {
    if (followerId.toString() === followingId.toString()) {
      throw new InternalServerErrorException(Message.SELF_SUBSCRIPTION_DENIED);
    }

    const targetId = await this.memberService.getMember(null, followingId);

    if (!targetId) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    const result = await this.registerSubscription(followerId, followingId);

    await this.memberService.memberStatusEditor({
      _id: followerId,
      targetKey: "memberFollowings",
      modifier: 1,
    });

    await this.memberService.memberStatusEditor({
      _id: followingId,
      targetKey: "memberFollowers",
      modifier: 1,
    });

    return result;
  }

  private async registerSubscription(
    followerId: Types.ObjectId,
    followingId: Types.ObjectId,
  ): Promise<Follower> {
    try {
      return (await this.followModel.create({
        followerId,
        followingId,
      })) as Follower;
    } catch (err) {
      console.log("Error ServiceModel", err);

      throw new BadRequestException(Message.CREATE_FAILED);
    }
  }

  public async unsubscribe(
    followingId: Types.ObjectId,
    followerId: Types.ObjectId,
  ): Promise<Follower> {
    const targetMember = await this.memberService.getMember(null, followingId);

    if (!targetMember) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    const result = await this.followModel.findOneAndDelete({
      followingId,
      followerId,
    });

    if (!result) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    await this.memberService.memberStatusEditor({
      _id: followerId,
      targetKey: "memberFollowings",
      modifier: -1,
    });

    await this.memberService.memberStatusEditor({
      _id: followingId,
      targetKey: "memberFollowers",
      modifier: -1,
    });

    return result as Follower;
  }

  public async getMemberFollowings(
    memberId: Types.ObjectId,
    input: FollowInquiry,
  ): Promise<Followings> {
    const { page, limit, search } = input;

    if (!search?.followerId) {
      throw new InternalServerErrorException(Message.BAD_REQUEST);
    }

    const match = {
      followerId: search.followerId,
    };

    console.log("match:", match);

    const result = await this.followModel
      .aggregate([
        {
          $match: match,
        },
        {
          $sort: {
            createdAt: Direction.DESC,
          },
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
              lookupFollowingData,
              {
                $unwind: "$followingData",
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

    if (!result?.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  public async getMemberFollowers(
    memberId: Types.ObjectId,
    input: FollowInquiry,
  ): Promise<Followers> {
    const { page, limit, search } = input;

    if (!search?.followingId) {
      throw new InternalServerErrorException(Message.BAD_REQUEST);
    }

    const match = {
      followingId: search.followingId,
    };

    console.log("match:", match);

    const result = await this.followModel
      .aggregate([
        {
          $match: match,
        },
        {
          $sort: {
            createdAt: Direction.DESC,
          },
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

              lookupFollowerData,

              {
                $unwind: "$followerData",
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
}
