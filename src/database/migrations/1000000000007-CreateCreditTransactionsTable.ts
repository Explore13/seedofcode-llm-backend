import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCreditTransactionsTable1000000000007 implements MigrationInterface {
    name = 'CreateCreditTransactionsTable1000000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."credit_transactions_reason_enum" AS ENUM('chat_completion', 'reservation', 'shortfall', 'refund', 'topup', 'signup_bonus', 'admin_adjustment')`);
        await queryRunner.query(`CREATE TABLE "credit_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "amount" integer NOT NULL, "reason" "public"."credit_transactions_reason_enum" NOT NULL, "usageLogId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_a408319811d1ab32832ec86fc2c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "credit_transactions" ADD CONSTRAINT "FK_92a0344bdfad756bc5e80b7525f" FOREIGN KEY ("usageLogId") REFERENCES "usage_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_92a0344bdfad756bc5e80b7525f"`);
        await queryRunner.query(`DROP TABLE "credit_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."credit_transactions_reason_enum"`);
    }
}
