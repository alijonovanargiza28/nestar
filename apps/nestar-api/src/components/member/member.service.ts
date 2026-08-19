import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Member } from "../../libs/dto/member/member";
import { LoginInput, MemberInput } from "../../libs/dto/member/member.input";
import { MemberStatus } from "../../libs/enums/member.enum";
import { Message } from "../../libs/enums/common.enum";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class MemberService {
  constructor(
    @InjectModel("Member") private readonly memberModel: Model<Member>,
    private authService: AuthService,
  ) {}

  public async signup(input: MemberInput): Promise<Member> {
    input.memberPassword = await this.authService.hashPassword(
      input.memberPassword,
    );
    try {
      const result = await this.memberModel.create(input);
      //  TODO: Authentication via Token
      result.accessToken = await this.authService.createToken(result);
      return result;
    } catch (err) {
      console.log("Error, Service.model", err);
      throw new BadRequestException(err);
    }
  }

  public async login(input: LoginInput): Promise<Member> {
    const { memberNick, memberPassword } = input;
    const response = await this.memberModel
      .findOne({ memberNick: memberNick })
      .select("+memberPassword")
      .exec();

    if (!response || response.memberStatus === MemberStatus.DELETE) {
      throw new BadRequestException(Message.NO_MEMBER_NICK);
    } else if (response.memberStatus === MemberStatus.BLOCK) {
      throw new BadRequestException(Message.BLOCKED_USER);
    }

    const isMatch = await this.authService.comparePassword(
      input.memberPassword,
      response.memberPassword!,
    );

    if (!isMatch) {
      throw new InternalServerErrorException(Message.WRONG_PASSWORD);
    }
    response.accessToken = await this.authService.createToken(response);
    return response;
  }

  public async updateMember(): Promise<string> {
    return "updateMember expecuted";
  }
  public async getMember(): Promise<string> {
    return "get member executed";
  }
  public async getAllMemberByAdmin(): Promise<string> {
    return "getAllMemberByAdmin executed!";
  }
  public async updateMemberByAdmin(): Promise<string> {
    return "updateMemberByAdmin executed!";
  }
}
