import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';


@ApiTags('Kyc Verification')
@ApiBearerAuth('JWT-auth')
@Controller('crypto')
export class CryptoController {}
