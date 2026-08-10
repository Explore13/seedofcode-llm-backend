import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateModelsTable1000000000004 implements MigrationInterface {
    name = 'CreateModelsTable1000000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."models_provider_enum" AS ENUM('ollama')`);
        await queryRunner.query(`CREATE TABLE "models" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "provider" "public"."models_provider_enum" NOT NULL DEFAULT 'ollama', "enabled" boolean NOT NULL DEFAULT true, "maxContext" integer, "capabilities" jsonb NOT NULL DEFAULT '[]', "family" character varying, "parameterSize" character varying, "parameterCount" bigint, "quantizationLevel" character varying, "sizeBytes" bigint, "digest" character varying, "creditsPerInputToken" integer NOT NULL DEFAULT '0', "creditsPerOutputToken" integer NOT NULL DEFAULT '0', "lastSyncedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_3492c71396207453cf17c0928fb" UNIQUE ("name"), CONSTRAINT "PK_ef9ed7160ea69013636466bf2d5" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "models"`);
        await queryRunner.query(`DROP TYPE "public"."models_provider_enum"`);
    }
}
