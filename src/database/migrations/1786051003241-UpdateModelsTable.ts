import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateModelsTable1786051003241 implements MigrationInterface {
    name = 'UpdateModelsTable1786051003241'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "supportsTools"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "supportsImages"`);
        await queryRunner.query(`CREATE TYPE "public"."models_provider_enum" AS ENUM('ollama')`);
        await queryRunner.query(`ALTER TABLE "models" ADD "provider" "public"."models_provider_enum" NOT NULL DEFAULT 'ollama'`);
        await queryRunner.query(`ALTER TABLE "models" ADD "capabilities" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "models" ADD "family" character varying`);
        await queryRunner.query(`ALTER TABLE "models" ADD "parameterSize" character varying`);
        await queryRunner.query(`ALTER TABLE "models" ADD "parameterCount" bigint`);
        await queryRunner.query(`ALTER TABLE "models" ADD "quantizationLevel" character varying`);
        await queryRunner.query(`ALTER TABLE "models" ADD "sizeBytes" bigint`);
        await queryRunner.query(`ALTER TABLE "models" ADD "digest" character varying`);
        await queryRunner.query(`ALTER TABLE "models" ADD "creditsPerInputToken" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "models" ADD "creditsPerOutputToken" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "models" ADD "lastSyncedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "models" ALTER COLUMN "maxContext" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "models" ALTER COLUMN "maxContext" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "lastSyncedAt"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "creditsPerOutputToken"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "creditsPerInputToken"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "digest"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "sizeBytes"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "quantizationLevel"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "parameterCount"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "parameterSize"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "family"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "capabilities"`);
        await queryRunner.query(`ALTER TABLE "models" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP TYPE "public"."models_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "models" ADD "supportsImages" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "models" ADD "supportsTools" boolean NOT NULL DEFAULT false`);
    }

}
