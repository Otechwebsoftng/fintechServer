import { Injectable, Scope } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger extends Logger  {

  constructor(private configService: ConfigService){
    super();
  }
  
  log(message: string, context?: string) {
    if (this.configService.get('NODE_ENV') === 'development') {
        super.log(message, context);
    }
 }


  fatal(message: string, context?: string) {
    super.fatal(message, context);
  }

 
  error(message: string, context?: string) {
    super.error(message, context);
  }

 
  warn(message: string, context?: string) {
    super.warn(message, context);
  }


  debug(message: string, context?: string) {
    if (this.configService.get('NODE_ENV') === 'development') {
      super.debug(message, context);
    }
  }

 
  verbose(message: string, context?: string) {
    if (this.configService.get('NODE_ENV') === 'development') {
      super.verbose(message, context);
    }
  }
}