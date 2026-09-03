import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

import {
  BoardArticle,
  BoardArticles,
} from "../../libs/dto/board-article/board-article";

import {
  AllBoardArticlesInquiry,
  BoardArticleInput,
  BoardArticlesInquiry,
} from "../../libs/dto/board-article/board-article.input";

import { BoardArticleUpdate } from "../../libs/dto/board-article/board-article.update";

import { MemberService } from "../member/member.service";
import { ViewService } from "../view/view.service";

import { Direction, Message } from "../../libs/enums/common.enum";
import { ViewGroup } from "../../libs/enums/view.enum";
import { BoardArticleStatus } from "../../libs/enums/board-article.enum";

import { StatisticModifier, T } from "../../libs/types/common";

import { lookupMember, shapeIntoMongoObjectId } from "../../libs/config";

@Injectable()
export class BoardArticleService {
  constructor(
    @InjectModel("BoardArticle")
    private readonly boardArticleModel: Model<BoardArticle>,

    private readonly memberService: MemberService,

    private readonly viewService: ViewService,
  ) {}

  // CREATE BOARD ARTICLE
  public async createBoardArticle(
    memberId: Types.ObjectId,
    input: BoardArticleInput,
  ): Promise<BoardArticle> {
    console.log("memberId:", memberId);

    input.memberId = memberId;

    try {
      const result = await this.boardArticleModel.create(input);

      await this.memberService.memberStatusEditor({
        _id: memberId,
        targetKey: "memberArticles",
        modifier: 1,
      });

      return result;
    } catch (err) {
      console.log("Error, Service.model:", err);
      throw new BadRequestException(Message.CREATE_FAILED);
    }
  }

  // GET ONE BOARD ARTICLE
  public async getBoardArticle(
    memberId: Types.ObjectId,
    articleId: Types.ObjectId,
  ): Promise<BoardArticle> {
    const search: T = {
      _id: articleId,
      articleStatus: BoardArticleStatus.ACTIVE,
    };

    const targetBoardArticle: BoardArticle | null = await this.boardArticleModel
      .findOne(search)
      .lean()
      .exec();

    if (!targetBoardArticle) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    // RECORD VIEW
    if (memberId) {
      const viewInput = {
        memberId: memberId,
        viewRefId: articleId,
        viewGroup: ViewGroup.ARTICLE,
      };

      const newView = await this.viewService.recordView(viewInput);

      if (newView) {
        await this.boardArticleStatusEditor({
          _id: articleId,
          targetKey: "articleViews",
          modifier: 1,
        });

        targetBoardArticle.articleViews++;
      }
    }

    // GET MEMBER DATA
    targetBoardArticle.memberData = await this.memberService.getMember(
      null,
      shapeIntoMongoObjectId(targetBoardArticle.memberId),
    );

    return targetBoardArticle;
  }

  // UPDATE BOARD ARTICLE
  public async updateBoardArticle(
    memberId: Types.ObjectId,
    input: BoardArticleUpdate,
  ): Promise<BoardArticle> {
    const { _id, articleStatus } = input;

    // GraphQL'dan string keladi
    // MongoDB uchun ObjectId qilamiz
    const articleId = shapeIntoMongoObjectId(_id);

    const result = await this.boardArticleModel
      .findOneAndUpdate(
        {
          _id: articleId,
          memberId: memberId,
          articleStatus: BoardArticleStatus.ACTIVE,
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

    // ARTICLE DELETE bo'lsa memberArticles -1
    if (articleStatus === BoardArticleStatus.DELETE) {
      await this.memberService.memberStatusEditor({
        _id: memberId,
        targetKey: "memberArticles",
        modifier: -1,
      });
    }

    return result;
  }

  // GET BOARD ARTICLES
  public async getBoardArticles(
    memberId: Types.ObjectId,
    input: BoardArticlesInquiry,
  ): Promise<BoardArticles> {
    const { articleCategory, text } = input.search;

    const match: T = {
      articleStatus: BoardArticleStatus.ACTIVE,
    };

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    // CATEGORY SEARCH
    if (articleCategory) {
      match.articleCategory = articleCategory;
    }

    // TEXT SEARCH
    if (text) {
      match.articleTitle = {
        $regex: new RegExp(text, "i"),
      };
    }

    // MEMBER SEARCH
    if (input.search.memberId) {
      match.memberId = shapeIntoMongoObjectId(input.search.memberId);
    }

    console.log("match", match);

    const result = await this.boardArticleModel
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

  // GET ALL BOARD ARTICLES BY ADMIN
  public async getBoardArticlesByAdmin(
    input: AllBoardArticlesInquiry,
  ): Promise<BoardArticles> {
    const { articleStatus, articleCategory } = input.search;

    const match: T = {};

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    // STATUS SEARCH
    if (articleStatus) {
      match.articleStatus = articleStatus;
    }

    // CATEGORY SEARCH
    if (articleCategory) {
      match.articleCategory = articleCategory;
    }

    const result = await this.boardArticleModel
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

  // UPDATE BOARD ARTICLE BY ADMIN
  public async updateBoardArticleByAdmin(
    input: BoardArticleUpdate,
  ): Promise<BoardArticle> {
    const { _id, articleStatus } = input;

    const articleId = shapeIntoMongoObjectId(_id);

    const result = await this.boardArticleModel
      .findOneAndUpdate(
        {
          _id: articleId,
          articleStatus: BoardArticleStatus.ACTIVE,
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

    // ARTICLE DELETE bo'lsa memberArticles -1
    await this.memberService.memberStatusEditor({
      _id: shapeIntoMongoObjectId(result.memberId),
      targetKey: "memberArticles",
      modifier: -1,
    });

    return result;
  }

  // REMOVE BOARD ARTICLE BY ADMIN
  public async removeBoardArticleByAdmin(
    articleId: Types.ObjectId,
  ): Promise<BoardArticle> {
    const search: T = {
      _id: articleId,
      articleStatus: BoardArticleStatus.DELETE,
    };

    const result = await this.boardArticleModel.findOneAndDelete(search).exec();

    if (!result) {
      throw new InternalServerErrorException(Message.REMOVE_FAILED);
    }

    return result;
  }

  // BOARD ARTICLE STATUS EDITOR
  public async boardArticleStatusEditor(
    input: StatisticModifier,
  ): Promise<BoardArticle> {
    const { _id, targetKey, modifier } = input;

    const result = await this.boardArticleModel
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
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    return result;
  }
}
