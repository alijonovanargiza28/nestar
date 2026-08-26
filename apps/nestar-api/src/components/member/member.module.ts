import { Module } from "@nestjs/common";
import { MemberResolver } from "./member.resolver";
import { MongooseModule } from "@nestjs/mongoose";
import MemberSchema from "../../schemas/Member.model";
import { AuthModule } from "../auth/auth.module";
import { ViewModule } from "../view/view.module";
import { MemberService } from "./member.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: "Member", schema: MemberSchema }]),
    AuthModule,
    ViewModule,
  ],
  providers: [MemberResolver, MemberService],
  exports:[MemberModule, MemberService]
})
export class MemberModule {}
