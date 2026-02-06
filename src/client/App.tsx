/**
 * Root application component.
 * Wires together all providers and the app shell.
 */

import React from 'react';
import { ThemeProvider } from './store/ThemeContext';
import { LogProvider } from './store/LogContext';
import { FilterProvider } from './store/FilterContext';
import { AppShell } from './components/shell/AppShell';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LogProvider>
        <FilterProvider>
          <AppShell />
        </FilterProvider>
      </LogProvider>
    </ThemeProvider>
  );
};
