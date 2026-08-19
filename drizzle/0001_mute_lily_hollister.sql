CREATE TABLE "mensagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"de_email_id" integer NOT NULL,
	"de_email" varchar(100) NOT NULL,
	"de_nome" varchar(100) NOT NULL,
	"para_email" varchar(100) NOT NULL,
	"assunto" varchar(255) DEFAULT '(Sem assunto)' NOT NULL,
	"corpo" text DEFAULT '' NOT NULL,
	"lida" boolean DEFAULT false,
	"pasta" varchar(20) DEFAULT 'entrada',
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	"expira_em" timestamp NOT NULL,
	CONSTRAINT "sessoes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "status_pagamento" varchar(20) DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "pagbank_order_id" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "pagbank_charge_id" varchar(100) DEFAULT '';