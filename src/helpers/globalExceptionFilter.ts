import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    constructor(private configService: ConfigService) { }
    catch(exception: Error, host: ArgumentsHost) {
        // const ctx = host.switchToHttp();
        // const response = ctx.getResponse<Response>();
        // const status = exception.getStatus();
        // const message = exception.message;
        // console.log({ exception })
        // const isProduction =
        //     this.configService.get<string>('NODE_ENV') === 'production'


        // response
        //     .status(status)
        //     .json(
        //         isProduction ? {
        //             status: 'error',
        //             statusCode: status,
        //             message
        //         }
        //             : {
        //                 status: 'error',
        //                 statusCode: status,
        //                 message,
        //                 stack: exception.stack
        //             });

        let { message: errMsg, stack: errStack, name: errName } = exception;
        let ctx = host.switchToHttp();
        let req = ctx.getRequest();
        let res = ctx.getResponse();

        // HttpException Error
        if (exception instanceof HttpException) {
            return res.status(exception.getStatus()).json({ status: 'error', message: exception.getResponse() });
        }
        // other error to rewirte InternalServerErrorException response
        // console.log(errStack);
        res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        return res.status(res.statusCode).json({ status: 'error', message: errMsg });

    }
}