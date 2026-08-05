import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsageLogsTable1000000000006 implements MigrationInterface {
    name = 'CreateUsageLogsTable1000000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."usage_logs_status_enum" AS ENUM('success', 'error', 'timeout')`);
        await queryRunner.query(`CREATE TABLE "usage_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "apiKeyId" character varying, "model" character varying NOT NULL, "promptTokens" integer NOT NULL, "completionTokens" integer NOT NULL, "latencyMs" integer NOT NULL, "status" "public"."usage_logs_status_enum" NOT NULL, "creditsCost" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_38ed6efac407c7a3f818d90c279" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "usage_logs"`);
        await queryRunner.query(`DROP TYPE "public"."usage_logs_status_enum"`);
    }
}
