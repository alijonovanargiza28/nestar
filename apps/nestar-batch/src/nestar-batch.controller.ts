import { Controller, Get, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NestarBatchService } from "./nestar-batch.service";
import {
  BATCH_ROLLBACK,
  BATCH_TOP_PROPERTIES,
  BATCH_TOP_AGENTS,
} from "./lib/config";

@Controller()
export class NestarBatchController {
  private logger: Logger = new Logger("BatchController");

  constructor(private readonly nestarBatchService: NestarBatchService) {}

  // Har kuni 01:00:00 da ishlaydi
  @Cron("0 0 1 * * *", { name: BATCH_ROLLBACK })
  public async batchRollback() {
    try {
      this.logger["context"] = BATCH_ROLLBACK;
      this.logger.debug("EXECUTED!");

      await this.nestarBatchService.batchRollback();
    } catch (error) {
      this.logger.error(error);
    }
  }

  // Har kuni 01:00:20 da ishlaydi
  @Cron("20 0 1 * * *", { name: BATCH_TOP_PROPERTIES })
  public async batchTopProperties() {
    try {
      this.logger["context"] = BATCH_TOP_PROPERTIES;
      this.logger.debug("EXECUTED!");

      await this.nestarBatchService.batchTopProperties();
    } catch (error) {
      this.logger.error(error);
    }
  }

  // Har kuni 01:00:40 da ishlaydi
  @Cron("40 0 1 * * *", { name: BATCH_TOP_AGENTS })
  public async batchTopAgents() {
    try {
      this.logger["context"] = BATCH_TOP_AGENTS;
      this.logger.debug("EXECUTED!");

      await this.nestarBatchService.batchTopAgents();
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Get()
  getHello(): string {
    return this.nestarBatchService.getHello();
  }
}
