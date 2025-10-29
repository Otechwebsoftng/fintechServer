import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';


export const CurrentUser = createParamDecorator(
    (data, context: ExecutionContext): User=>{
        const req = context.switchToHttp().getRequest(); //the request data is gotten here
        return req.user;
    }
)