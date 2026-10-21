-- AlterTable
ALTER TABLE `barista_sessions` ADD COLUMN `courseType` ENUM('barista', 'cupping', 'roasting', 'cva') NOT NULL DEFAULT 'barista',
    ADD COLUMN `level` ENUM('Foundation', 'Intermediate', 'Professional') NULL;

-- AlterTable
ALTER TABLE `products` MODIFY `gallery` JSON NULL;

-- AlterTable
ALTER TABLE `tables` ADD COLUMN `qrToken` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `permissions` JSON NULL;

-- CreateTable
CREATE TABLE `table_bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `partySize` INTEGER NOT NULL DEFAULT 1,
    `startTime` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 60,
    `status` ENUM('Upcoming', 'Active', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Upcoming',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_booking_tables` (
    `bookingId` INTEGER NOT NULL,
    `tableId` INTEGER NOT NULL,

    PRIMARY KEY (`bookingId`, `tableId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_stories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeName` VARCHAR(191) NOT NULL,
    `roleTitle` VARCHAR(191) NULL,
    `story` TEXT NOT NULL,
    `coverImage` VARCHAR(191) NOT NULL,
    `gallery` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `tables_qrToken_key` ON `tables`(`qrToken`);

-- AddForeignKey
ALTER TABLE `table_booking_tables` ADD CONSTRAINT `table_booking_tables_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `table_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_booking_tables` ADD CONSTRAINT `table_booking_tables_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `tables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

