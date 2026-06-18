import { Module } from '@nestjs/common';
import { EcampusModule } from '@ecampus/ecampus.module';

@Module({
    imports: [EcampusModule]
})
export class AppModule {}
