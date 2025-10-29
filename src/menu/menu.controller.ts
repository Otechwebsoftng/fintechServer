import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { PermissionsGuard } from 'src/auth/guard/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { CreateMenuDto } from './dto/createMenu.dto';

@ApiTags('Menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({
    description: 'Fetch Menu ',
    summary: 'Return menu base on permissions',
  })
  @UseGuards(AuthGuard())
  async getMenu(@CurrentUser() user: User) {
    const userId = user.id;
    return await this.menuService.getUserMenu(userId);
  }

  @Post()
  @ApiOperation({
    description: 'Create Parent menu Items',
    summary: 'Create parent menu item',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access')
  async createParentMenu(@Body() payload: CreateMenuDto) {
    return await this.menuService.createParentMenu(payload);
  }

  @Post(':parentId/child-menu')
  @ApiOperation({
    description: 'Create Parent menu Items',
    summary: 'Create parent menu item',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access')
  async createChildMenu(
    @Param('parentId') parentId: string,
    @Body() payload: CreateMenuDto,
  ) {
    return await this.menuService.createChildMenu(parentId, payload);
  }
}
