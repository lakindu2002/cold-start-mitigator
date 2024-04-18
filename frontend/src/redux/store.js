import { configureStore } from '@reduxjs/toolkit';

import projectsReducer from './slices/projects';

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
  },
});
