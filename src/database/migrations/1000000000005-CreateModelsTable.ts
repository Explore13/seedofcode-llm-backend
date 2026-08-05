import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateModelsTable1000000000005 implements MigrationInterface {
    name = 'CreateModelsTable1000000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "models" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "maxContext" integer NOT NULL, "supportsTools" boolean NOT NULL DEFAULT false, "supportsImages" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_3492c71396207453cf17c0928fb" UNIQUE ("name"), CONSTRAINT "PK_ef9ed7160ea69013636466bf2d5" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "models"`);
    }
}
