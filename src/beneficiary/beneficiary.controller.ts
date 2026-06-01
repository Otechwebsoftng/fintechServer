import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BeneficiaryService } from './beneficiary.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateBeneficiaryDto } from './dto/createBeneficiary.dto';

@ApiTags('Beneficiaries')
@Controller('beneficiary')
export class BeneficiaryController {
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

  @Get()
  @ApiOperation({
    description: ' Fetch all beneficiaries',
    summary: 'Get all beneficiaries of the currently logged in user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Number of beneficiaries to return per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Search beneficiaries by bankName, accountName or accountNumber',
  })
  @UseGuards(AuthGuard())
  async getAllUsers(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    const userId = user.id;
    return this.beneficiaryService.getAll(userId, page, pageSize, search);
  }

  @Get(':id')
  @ApiOperation({
    description: 'Fetch a beneficiary by ID',
    summary: 'Fetch a beneficiary by ID',
  })
  async viewOne(@Param('id') id: string) {
    return this.beneficiaryService.viewOne(id);
  }

  @ApiOperation({
    description: 'Create Beneficiary ',
    summary: 'Create a beneficiary for the currently logged in user',
  })
  @Post()
  @UseGuards(AuthGuard())
  async createBeneficiary(
    @CurrentUser() user: User,
    @Body() payload: CreateBeneficiaryDto,
  ) {
    const userId = user.id;
    return this.beneficiaryService.createBeneficiary(userId, payload);
  }

  @ApiOperation({
    description: 'Delete Beneficiary ',
    summary: 'Delete a beneficiary for the currently logged in user',
  })
  @Delete(':id/delete')
  @UseGuards(AuthGuard())
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    const userId = user.id;
    return this.beneficiaryService.deleteBeneficiary(userId, id);
  }
}
