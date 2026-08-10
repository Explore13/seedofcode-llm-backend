import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1000000000000 implements MigrationInterface {
    name = 'CreateUsersTable1000000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_plan_enum" AS ENUM('free', 'pro', 'enterprise')`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "email" character varying NOT NULL, "password" character varying NOT NULL, "plan" "public"."users_plan_enum" NOT NULL DEFAULT 'free', "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "verified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_plan_enum"`);
    }
}
