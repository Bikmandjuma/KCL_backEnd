-- AlterTable
ALTER TABLE `orders` ADD COLUMN `etaMinutes` INTEGER NULL,
    ADD COLUMN `etaSetAt` DATETIME(3) NULL;
