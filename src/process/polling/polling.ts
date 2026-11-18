import type { TaskResponse } from '../../shared/api';
import { wait } from '../../shared/lib/async';
import { requestPoll } from '../../entities/signing';
import type { ProcessReply, RequestOptions } from '../../entities/signing';

// Сообщает сценарию каждый новый task и возвращает первый ответ без task.
export async function pollUntilProcess(
  task: TaskResponse,
  options: RequestOptions,
  onTask: (task: TaskResponse) => void,
): Promise<ProcessReply> {
  // Следующая пауза начинается после ответа, поэтому poll-запросы не пересекаются.
  onTask(task);
  await wait(options.settings.pull_time, options.signal);
  const reply = await requestPoll(task.task, options);
  if (reply.data.kind !== 'task') {
    return reply;
  }
  return pollUntilProcess(reply.data.response, options, onTask);
}
