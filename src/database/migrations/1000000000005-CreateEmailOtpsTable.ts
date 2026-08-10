import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmailOtpsTable1000000000005 implements MigrationInterface {
    name = 'CreateEmailOtpsTable1000000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."email_otps_purpose_enum" AS ENUM('email_verification', 'password_reset')`);
        await queryRunner.query(`CREATE TABLE "email_otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purpose" "public"."email_otps_purpose_enum" NOT NULL DEFAULT 'email_verification', "userId" character varying, "email" character varying NOT NULL, "otp" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "verifiedAt" TIMESTAMP, "attempts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_c66a6bae8086377ae2b0f5b177e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "email_otps"`);
        await queryRunner.query(`DROP TYPE "public"."email_otps_purpose_enum"`);
    }
}
