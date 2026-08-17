import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { MemberService } from "./member.service";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { LoginInput, MemberInput } from "../../libs/dto/member/member.input";
import { Member } from "../../libs/dto/member/member";
import { Message } from "../../libs/enums/common.enum";

@Resolver()
export class MemberResolver {
  constructor(private readonly memberService: MemberService) {}

  @Mutation(() => Member)
  public async signup(@Args("input") input: MemberInput): Promise<Member> {
    try {
      console.log("Mutation: signup");
      console.log("input", input);

      return this.memberService.signup(input);
    } catch (err) {
      if (err instanceof Error) {
        console.log("Error, signup", err.message);
      } else {
        console.log("Error, signup", err);
      }

      throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
    }
  }

  @Mutation(() => Member)
  public async login(@Args("input") input: LoginInput): Promise<Member> {
    try {
      console.log("Mutation: login");

      return this.memberService.login(input);
    } catch (err) {
      console.log("Error, login", err);

      if (err instanceof Error) {
        throw new InternalServerErrorException(err.message);
      }

      throw new InternalServerErrorException("Login failed");
    }
  }

  @Mutation(() => String)
  public async updateMember(): Promise<string> {
    console.log("Mutation: updateMember");

    return this.memberService.updateMember();
  }

  @Query(() => String)
  public async getMember(): Promise<string> {
    console.log("Query: getMember");

    return this.memberService.getMember();
  }
}
