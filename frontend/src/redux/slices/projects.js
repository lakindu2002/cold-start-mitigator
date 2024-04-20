import toast from 'react-hot-toast';
import { createSlice } from '@reduxjs/toolkit';

import axiosLiveInstance from 'src/lib/axios';

const initialState = {
  project: undefined,
  projectLoading: false,
  functions: [],
  functionsLoading: false,
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
    },
    setFunctions: (state, action) => {
      state.functions = action.payload.functions;
    },
    setFunctionsLoading: (state, action) => {
      state.functionsLoading = action.payload.loading;
    }
  },
});

export default projectsSlice.reducer;

export const getProjectById = (projectId) => async (dispatch) => {
  dispatch(projectsSlice.actions.setProjectLoading({ loading: true }));
  try {
    const resp = await axiosLiveInstance.get(`/api/projects/${projectId}`)
    dispatch(projectsSlice.actions.setProject({ project: resp.data.project }))
  } catch (err) {
    toast.error('We could not fetch the project. Please try again later.')
  } finally {
    dispatch(projectsSlice.actions.setProjectLoading({ loading: false }));
  }
}

export const setProject = (project) => async (dispatch) => {
  dispatch(projectsSlice.actions.setProject({ project }));
}

export const patchProject = (projectId, projectToPatch) => async (dispatch) => {
  await axiosLiveInstance.patch(`/api/projects/${projectId}`, projectToPatch)
  dispatch(projectsSlice.actions.updateProject({ project: projectToPatch }))
}

export const getFunctionsInProject = () => async (dispatch, getState) => {
  const { projects: { project: { id: projectId } } } = getState();

  dispatch(projectsSlice.actions.setFunctionsLoading({ loading: true }));
  try {
    const resp = await axiosLiveInstance.get(`/api/projects/${projectId}/functions`)
    dispatch(projectsSlice.actions.setFunctions({ functions: resp.data.functions }))
  } catch (err) {
    toast.error('We could not fetch the functions in this project. Please try again later.')
  } finally {
    dispatch(projectsSlice.actions.setFunctionsLoading({ loading: false }));
  }
}
