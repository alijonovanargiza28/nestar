import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import { InjectModel } from "@nestjs/mongoose";

import { Model, Types } from "mongoose";

import {
  AgentsInquiry,
  LoginInput,
  MemberInput,
  MembersInquiry,
} from "../../libs/dto/member/member.input";

import { MemberStatus, MemberType } from "../../libs/enums/member.enum";

import { Direction, Message } from "../../libs/enums/common.enum";

import { AuthService } from "../auth/auth.service";

import { MemberUpdate } from "../../libs/dto/member/member.update";

import { StatisticModifier, T } from "../../libs/types/common";

import { ViewService } from "../view/view.service";

import { ViewGroup } from "../../libs/enums/view.enum";

import { Member, Members } from "../../libs/dto/member/member";

import { LikeInput } from "../../libs/dto/like/like.input";

import { LikeGroup } from "../../libs/enums/like.enum";

import { LikeService } from "../like/like.service";

import { Follower, Following, MeFollowed } from "../../libs/dto/follow/follow";

@Injectable()
export class MemberService {
  constructor(
    @InjectModel("Member")
    private readonly memberModel: Model<Member>,

    @InjectModel("Follow")
    private readonly followModel: Model<Follower | Following>,

    private readonly authService: AuthService,

    private readonly viewService: ViewService,

    private readonly likeService: LikeService,
  ) {}

  // ========================= SIGNUP =========================

  public async signup(input: MemberInput): Promise<Member> {
    input.memberPassword = await this.authService.hashPassword(
      input.memberPassword,
    );

    try {
      const result = await this.memberModel.create(input);

      result.accessToken = await this.authService.createToken(result);

      return result;
    } catch (err) {
      console.log(
        "Error, Service.model:",
        err instanceof Error ? err.message : err,
      );

      throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
    }
  }

  // ========================= LOGIN =========================

  public async login(input: LoginInput): Promise<Member> {
    const { memberNick, memberPassword } = input;

    const response = await this.memberModel
      .findOne({
        memberNick: memberNick,
      })
      .select("+memberPassword")
      .exec();

    if (!response || response.memberStatus === MemberStatus.DELETE) {
      throw new BadRequestException(Message.NO_MEMBER_NICK);
    }

    if (response.memberStatus === MemberStatus.BLOCK) {
      throw new BadRequestException(Message.BLOCKED_USER);
    }

    const isMatch = await this.authService.comparePassword(
      memberPassword,
      response.memberPassword!,
    );

    if (!isMatch) {
      throw new InternalServerErrorException(Message.WRONG_PASSWORD);
    }

    response.accessToken = await this.authService.createToken(response);

    return response;
  }

  // ========================= UPDATE MEMBER =========================

  public async updateMember(
    memberId: Types.ObjectId,
    input: MemberUpdate,
  ): Promise<Member> {
    const result = await this.memberModel
      .findOneAndUpdate(
        {
          _id: memberId,
          memberStatus: MemberStatus.ACTIVE,
        },
        input,
        {
          new: true,
        },
      )
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    result.accessToken = await this.authService.createToken(result);

    return result;
  }

  // ========================= GET MEMBER =========================

  public async getMember(
    memberId: Types.ObjectId | null,
    targetId: Types.ObjectId,
  ): Promise<Member> {
    const search: T = {
      _id: targetId,

      memberStatus: {
        $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK],
      },
    };

    const targetMember = await this.memberModel.findOne(search).lean().exec();

    if (!targetMember) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    if (memberId) {
      // ================= VIEW =================

      const viewInput = {
        memberId: memberId,
        viewRefId: targetId,
        viewGroup: ViewGroup.Member,
      };

      const newView = await this.viewService.recordView(viewInput);

      if (newView) {
        await this.memberModel
          .findOneAndUpdate(
            search,
            {
              $inc: {
                memberViews: 1,
              },
            },
            {
              new: true,
            },
          )
          .exec();

        targetMember.memberViews++;
      }

      // ================= LIKE =================

      const likeInput: LikeInput = {
        memberId: memberId,
        likeRefId: targetId,
        likeGroup: LikeGroup.MEMBER,
      };

      targetMember.meLiked =
        await this.likeService.checkLikeExistence(likeInput);

      // ================= FOLLOW =================

      targetMember.meFollowed = await this.checkSubscription(
        memberId,
        targetId,
      );
    }

    return targetMember;
  }

  // ========================= CHECK SUBSCRIPTION =========================

  private async checkSubscription(
    followerId: Types.ObjectId,
    followingId: Types.ObjectId,
  ): Promise<MeFollowed[]> {
    const result = await this.followModel
      .findOne({
        followingId: followingId,
        followerId: followerId,
      })
      .exec();

    return result
      ? [
          {
            followerId: followerId,
            followingId: followingId,
            myFollowing: true,
          },
        ]
      : [];
  }

  // ========================= GET AGENTS =========================

  public async getAgents(
    memberId: Types.ObjectId,
    input: AgentsInquiry,
  ): Promise<Members> {
    const { text } = input.search;

    const match: T = {
      memberType: MemberType.AGENT,

      memberStatus: MemberStatus.ACTIVE,
    };

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    if (text) {
      match.memberNick = {
        $regex: new RegExp(text, "i"),
      };
    }

    console.log("match:", match);

    const result = await this.memberModel
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

    console.log("result:", result);

    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  // ========================= LIKE MEMBER =========================

  public async likeTargetMember(
    memberId: Types.ObjectId,
    likeRefId: Types.ObjectId,
  ): Promise<Member> {
    const target = await this.memberModel
      .findOne({
        _id: likeRefId,
        memberStatus: MemberStatus.ACTIVE,
      })
      .exec();

    if (!target) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    const input: LikeInput = {
      memberId: memberId,
      likeRefId: likeRefId,
      likeGroup: LikeGroup.MEMBER,
    };

    // LIKE TOGGLE -1 / +1
    const modifier: number = await this.likeService.toggleLike(input);

    const result = await this.memberStatusEditor({
      _id: likeRefId,
      targetKey: "memberLikes",
      modifier: modifier,
    });

    if (!result) {
      throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
    }

    return result;
  }

  // ========================= GET ALL MEMBER BY ADMIN =========================

  public async getAllMemberByAdmin(input: MembersInquiry): Promise<Members> {
    const { memberStatus, memberType, text } = input.search;

    const match: T = {};

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    if (memberStatus) {
      match.memberStatus = memberStatus;
    }

    if (memberType) {
      match.memberType = memberType;
    }

    if (text) {
      match.memberNick = {
        $regex: new RegExp(text, "i"),
      };
    }

    console.log("match:", match);

    const result = await this.memberModel
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

    console.log("result:", result);

    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  // ========================= UPDATE MEMBER BY ADMIN =========================

  public async updateMemberByAdmin(input: MemberUpdate): Promise<Member> {
    const result = await this.memberModel
      .findByIdAndUpdate(input._id, input, {
        new: true,
      })
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    return result;
  }

  // ========================= MEMBER STATUS EDITOR =========================

  public async memberStatusEditor(input: StatisticModifier): Promise<Member> {
    const { _id, targetKey, modifier } = input;

    console.log("INPUT ID:", _id);

    console.log("MODEL COLLECTION:", this.memberModel.collection.name);

    console.log("MODEL DB:", this.memberModel.db.name);

    const allMembers = await this.memberModel
      .find({})
      .select("_id memberNick memberArticles")
      .limit(10)
      .lean()
      .exec();

    console.log("MEMBERS:", allMembers);

    const member = await this.memberModel.findById(_id).exec();

    console.log("FOUND MEMBER:", member);

    const result = await this.memberModel
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
