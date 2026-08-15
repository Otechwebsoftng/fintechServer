import { Test, TestingModule } from '@nestjs/testing';
import { TransactionChargeService } from './transaction-charge.service';

describe('TransactionChargeService', () => {
  let service: TransactionChargeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionChargeService],
    }).compile();

    service = module.get<TransactionChargeService>(TransactionChargeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
