import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';

import { useProcess } from './useProcess';

const ProcessContext = createContext<ReturnType<typeof useProcess> | undefined>(
  undefined,
);

// Запускает процесс для текущей заявки и предоставляет экранам состояние и команды.
export function ProcessProvider({
  inquiryId,
  children,
  diagnoseWorkplace = false,
}: {
  inquiryId: string;
  children: ReactNode;
  diagnoseWorkplace?: boolean;
}) {
  const process = useProcess(inquiryId, undefined, diagnoseWorkplace);
  const { start } = process.commands;

  useEffect(() => {
    start();
  }, [start]);

  return (
    <ProcessContext.Provider value={process}>
      {children}
    </ProcessContext.Provider>
  );
}

export function useSigningProcess() {
  const context = useContext(ProcessContext);
  if (!context) {
    throw new Error('Процесс доступен только внутри ProcessProvider');
  }
  return context;
}
