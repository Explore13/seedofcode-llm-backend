import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOtpPurpose1786006904249 implements MigrationInterface {
    name = 'AddOtpPurpose1786006904249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."email_otps_purpose_enum" AS ENUM('email_verification', 'password_reset')`);
        await queryRunner.query(`ALTER TABLE "email_otps" ADD "purpose" "public"."email_otps_purpose_enum" NOT NULL DEFAULT 'email_verification'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_otps" DROP COLUMN "purpose"`);
        await queryRunner.query(`DROP TYPE "public"."email_otps_purpose_enum"`);
    }

}
