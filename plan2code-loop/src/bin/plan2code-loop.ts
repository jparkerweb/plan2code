import { run } from '../index.js';
import { logger } from '../utils/index.js';

async function main() {
  try {
    const result = await run();

    if (!result) {
      process.exit(0);
    }

    // Exit codes per spec
    switch (result.exitReason) {
      case 'all_complete':
        logger.success('Loop completed successfully - all tasks done!');
        process.exit(0);
      case 'max_iterations':
        logger.warning('Loop ended: max iterations reached');
        process.exit(1);
      case 'interrupted':
        logger.info('Loop interrupted by user');
        process.exit(2);
      case 'error':
        logger.error('Loop ended with error');
        process.exit(3);
    }

  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(3);
  }
}

main();
