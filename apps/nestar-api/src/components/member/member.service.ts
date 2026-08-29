import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import { InjectModel } from "@nestjs/mongoose";

import mongoose, { Model } from "mongoose";

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

@Injectable()
export class MemberService {
  constructor(
    @InjectModel("Member")
    private readonly memberModel: Model<Member>,

    private readonly authService: AuthService,

    private readonly viewService: ViewService,
  ) {}

  /**=========================== signup =============================**/

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

  /**=========================== login =============================**/

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

  /**=========================== updateMember =============================**/

  public async updateMember(
    memberId: mongoose.Types.ObjectId,
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

  /**=========================== getMember =============================**/

  public async getMember(
    memberId: mongoose.Types.ObjectId | null,
    targetId: mongoose.Types.ObjectId,
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
    }

    return targetMember;
  }

  /**=========================== getAgents =============================**/

  public async getAgents(
    memberId: mongoose.Types.ObjectId,
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

  /**=========================== getAllMemberByAdmin =============================**/

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

  /**=========================== updateMemberByAdmin =============================**/

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

  /**=========================== memberStatusEditor =============================**/

  public async memberStatusEditor(input: StatisticModifier): Promise<Member> {
    console.log("executed");

    const { _id, targetKey, modifier } = input;

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
