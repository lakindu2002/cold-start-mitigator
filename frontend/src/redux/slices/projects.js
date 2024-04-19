import { createSlice } from '@reduxjs/toolkit';

import axiosLiveInstance from 'src/lib/axios';

const initialState = {
  project: undefined,
  projectLoading: false,
};

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProject: (state, action) => {
      state.project = action.payload.project;
    },
    setProjectLoading: (state, action) => {
      state.projectLoading = action.payload.loading;
    },
    updateProject: (state, action) => {
      state.project = { ...state.project, ...action.payload.project };
    }
  },
});

export default projectsSlice.reducer;

export const getProjectById = (projectId) => async (dispatch) => {
  dispatch(projectsSlice.actions.setProjectLoading({ loading: true }));
  const resp = await axiosLiveInstance.get(`/api/projects/${projectId}`)
  dispatch(projectsSlice.actions.setProject({ project: resp.data.project }))
  dispatch(projectsSlice.actions.setProjectLoading({ loading: false }));
}

export const setProject = (project) => async (dispatch) => {
  dispatch(projectsSlice.actions.setProject({ project }));
}

export const patchProject = (projectId, projectToPatch) => async (dispatch) => {
  await axiosLiveInstance.patch(`/api/projects/${projectId}`, projectToPatch)
  dispatch(projectsSlice.actions.updateProject({ project: projectToPatch }))
}
