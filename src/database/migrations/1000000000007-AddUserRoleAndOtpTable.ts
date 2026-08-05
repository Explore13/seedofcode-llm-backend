import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRoleAndOtpTable1000000000007 implements MigrationInterface {
    name = 'AddUserRoleAndOtpTable1000000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying, "email" character varying NOT NULL, "otp" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "verifiedAt" TIMESTAMP, "attempts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_c66a6bae8086377ae2b0f5b177e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'user'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "email_otps"`);
    }

}
