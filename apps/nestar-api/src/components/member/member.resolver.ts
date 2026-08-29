import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { MemberService } from "./member.service";
import { UseGuards } from "@nestjs/common";

import {
  AgentsInquiry,
  LoginInput,
  MemberInput,
  MembersInquiry,
} from "../../libs/dto/member/member.input";

import { Message } from "../../libs/enums/common.enum";

import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthMember } from "../auth/decorators/authMember.decorator";
import { MemberType } from "../../libs/enums/member.enum";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MemberUpdate } from "../../libs/dto/member/member.update";

import {
  getSerialForImage,
  shapeIntoMongoObjectId,
  validMimeTypes,
} from "../../libs/config";

import { WithoutGuard } from "../auth/guards/without.guard";

import { GraphQLUpload, FileUpload } from "graphql-upload";

import { createWriteStream } from "fs";

import { Member, Members } from "../../libs/dto/member/member";

import mongoose from "mongoose";

@Resolver()
export class MemberResolver {
  constructor(private readonly memberService: MemberService) {}

  // ============================================================
  // SIGNUP
  // ============================================================

  @Mutation(() => Member)
  public async signup(@Args("input") input: MemberInput): Promise<Member> {
    console.log("Mutation: signup");

    return await this.memberService.signup(input);
  }

  // ============================================================
  // LOGIN
  // ============================================================

  @Mutation(() => Member)
  public async login(@Args("input") input: LoginInput): Promise<Member> {
    console.log("Mutation: login");

    return await this.memberService.login(input);
  }

  // ============================================================
  // CHECK AUTH
  // ============================================================

  @UseGuards(AuthGuard)
  @Query(() => String)
  public async checkAuth(
    @AuthMember("memberNick")
    memberNick: string,
  ): Promise<string> {
    console.log("Query: checkAuth");
    console.log("memberNick:", memberNick);

    return `Hi ${memberNick}`;
  }

  // ============================================================
  // CHECK AUTH ROLES
  // ============================================================

  @Roles(MemberType.USER, MemberType.AGENT)
  @UseGuards(RolesGuard)
  @Query(() => String)
  public async checkAuthRoles(
    @AuthMember() authMember: Member,
  ): Promise<string> {
    console.log("Query: checkAuthRoles");

    return `HI ${authMember.memberNick}, you are ${authMember.memberType} (memberId: ${authMember._id})`;
  }

  // ============================================================
  // UPDATE MEMBER
  // ============================================================

  @UseGuards(AuthGuard)
  @Mutation(() => Member)
  public async updateMember(
    @Args("input") input: MemberUpdate,

    @AuthMember("_id")
    memberId: mongoose.Types.ObjectId,
  ): Promise<Member> {
    console.log("Mutation: updateMember");

    // _id ni update qilishga ruxsat bermaymiz
    delete input._id;

    return await this.memberService.updateMember(memberId, input);
  }

  // ============================================================
  // GET MEMBER
  // ============================================================

  @UseGuards(WithoutGuard)
  @Query(() => Member)
  public async getMember(
    @Args("memberId") input: string,

    @AuthMember("_id")
    memberId: mongoose.Types.ObjectId,
  ): Promise<Member> {
    console.log("Query: getMember");

    const targetId = shapeIntoMongoObjectId(input);

    return await this.memberService.getMember(memberId, targetId);
  }

  // ============================================================
  // GET AGENTS
  // ============================================================

  @UseGuards(WithoutGuard)
  @Query(() => Members)
  public async getArgumentValues(
    @Args("input") input: AgentsInquiry,

    @AuthMember("_id")
    memberId: mongoose.Types.ObjectId,
  ): Promise<Members> {
    console.log("Query: getAgents");

    return await this.memberService.getAgents(memberId, input);
  }

  // ============================================================
  // ADMIN - GET ALL MEMBERS
  // ============================================================

  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Query(() => Members)
  public async getAllMemberByAdmin(
    @Args("input") input: MembersInquiry,
  ): Promise<Members> {
    console.log("Query: getAllMemberByAdmin");

    return await this.memberService.getAllMemberByAdmin(input);
  }

  // ============================================================
  // ADMIN - UPDATE MEMBER
  // ============================================================

  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Member)
  public async updateMemberByAdmin(
    @Args("input") input: MemberUpdate,
  ): Promise<Member> {
    console.log("Mutation: updateMemberByAdmin");

    return await this.memberService.updateMemberByAdmin(input);
  }

  // ============================================================
  // IMAGE UPLOADER
  // ============================================================

  @UseGuards(AuthGuard)
  @Mutation(() => String)
  public async imageUploader(
    @Args({
      name: "file",
      type: () => GraphQLUpload,
    })
    { createReadStream, filename, mimetype }: FileUpload,

    @Args("target")
    target: string,
  ): Promise<string> {
    console.log("Mutation: imageUploader");

    // filename tekshirish
    if (!filename) {
      throw new Error(Message.UPLOAD_FAILED);
    }

    // file type tekshirish
    const validMime = validMimeTypes.includes(mimetype);

    if (!validMime) {
      throw new Error(Message.PROVIDE_ALLOWED_FORMAT);
    }

    // unique image name
    const imageName = getSerialForImage(filename);

    // file path
    const url = `uploads/${target}/${imageName}`;

    // file stream
    const stream = createReadStream();

    // save file
    const result = await new Promise<boolean>((resolve, reject) => {
      stream
        .pipe(createWriteStream(url))
        .on("finish", () => {
          resolve(true);
        })
        .on("error", () => {
          reject(false);
        });
    });

    if (!result) {
      throw new Error(Message.UPLOAD_FAILED);
    }

    return url;
  }

  // ============================================================
  // MULTIPLE IMAGES UPLOADER
  // ============================================================

  @UseGuards(AuthGuard)
  @Mutation(() => [String])
  public async imagesUploader(
    @Args("files", {
      type: () => [GraphQLUpload],
    })
    files: Promise<FileUpload>[],

    @Args("target")
    target: string,
  ): Promise<string[]> {
    console.log("Mutation: imagesUploader");

    const uploadedImages: string[] = [];

    const promisedList = files.map(
      async (img: Promise<FileUpload>, index: number): Promise<void> => {
        try {
          const { filename, mimetype, createReadStream } = await img;

          // mime type tekshirish
          const validMime = validMimeTypes.includes(mimetype);

          if (!validMime) {
            throw new Error(Message.PROVIDE_ALLOWED_FORMAT);
          }

          // unique image name
          const imageName = getSerialForImage(filename);

          // file path
          const url = `uploads/${target}/${imageName}`;

          // stream
          const stream = createReadStream();

          // save image
          const result = await new Promise<boolean>((resolve, reject) => {
            stream
              .pipe(createWriteStream(url))
              .on("finish", () => {
                resolve(true);
              })
              .on("error", () => {
                reject(false);
              });
          });

          if (!result) {
            throw new Error(Message.UPLOAD_FAILED);
          }

          uploadedImages[index] = url;
        } catch (err) {
          console.log("Error, file missing!", err);
        }
      },
    );

    await Promise.all(promisedList);

    return uploadedImages;
  }
}
