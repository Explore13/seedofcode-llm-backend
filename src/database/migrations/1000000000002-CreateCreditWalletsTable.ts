import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCreditWalletsTable1000000000002 implements MigrationInterface {
    name = 'CreateCreditWalletsTable1000000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "credit_wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "balance" integer NOT NULL DEFAULT '1000', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_2a0bdee300eb8c2dbeb66649e13" UNIQUE ("userId"), CONSTRAINT "REL_2a0bdee300eb8c2dbeb66649e1" UNIQUE ("userId"), CONSTRAINT "PK_8b18298d800c7504182b7a227d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "credit_wallets" ADD CONSTRAINT "FK_2a0bdee300eb8c2dbeb66649e13" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_wallets" DROP CONSTRAINT "FK_2a0bdee300eb8c2dbeb66649e13"`);
        await queryRunner.query(`DROP TABLE "credit_wallets"`);
    }
}
