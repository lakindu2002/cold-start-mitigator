import toast from 'react-hot-toast';
import { createSlice } from '@reduxjs/toolkit';

import axiosLiveInstance from 'src/lib/axios';

const initialState = {
  project: undefined,
  projectLoading: false,
  functions: [],
  functionsLoading: false,
  predicting: false,
  predictingResults: [],
  logs: [],
  logsLoading: false,
  loadingMoreLogs: false,
  logsNextKey: undefined,
  creatingWarmer: false,
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
    },
    setPredicting: (state, action) => {
      state.predicting = action.payload.predicting;
    },
    setPredictingResults: (state, action) => {
      state.predictingResults = action.payload.predictingResults;
    },
    setLogs: (state, action) => {
      state.logs = action.payload.logs;
    },
    appendLogs: (state, action) => {
      state.logs = [...state.logs, ...action.payload.logs];
    },
    setLogsLoading: (state, action) => {
      state.logsLoading = action.payload.logsLoading;
    },
    setLoadingMoreLogs: (state, action) => {
      state.loadingMoreLogs = action.payload.loadingMoreLogs;
    },
    setLogsNextKey: (state, action) => {
      state.logsNextKey = action.payload.logsNextKey;
    },
    updateFunction: (state, action) => {
      state.functions = state.functions.map((f) => f.id === action.payload.function.id ? action.payload.function : f);
    },
    setCreatingWarmer: (state, action) => {
      state.creatingWarmer = action.payload.creatingWarmer;
    }
  }
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

export const predictInvocationTimesForFunctions = (functionNames) => async (dispatch, getState) => {
  const { project: { id } } = getState().projects;
  dispatch(projectsSlice.actions.setPredicting({ predicting: true }));
  try {
    const resp = await axiosLiveInstance.post(`/api/projects/${id}/functions/predict`, { functionNames })
    dispatch(projectsSlice.actions.setPredictingResults({ predictingResults: resp.data.results }))
    toast.success('We have predicted the invocation times for the selected functions.')
  } catch (err) {
    toast.error('We could not predict the invocation times for the selected functions. Please try again later.')
  } finally {
    dispatch(projectsSlice.actions.setPredicting({ predicting: false }));
  }
}

export const getLogsForFunction = (functionName, type) => async (dispatch, getState) => {
  const { project: { id }, logsNextKey } = getState().projects;
  if (type === 'initial') {
    dispatch(projectsSlice.actions.setLogsLoading({ logsLoading: true }));
  } else {
    dispatch(projectsSlice.actions.setLoadingMoreLogs({ loadingMoreLogs: true }));
  }
  try {
    if (type === 'initial') {
      dispatch(projectsSlice.actions.setLogs({ logs: [] }))
    }
    const resp = await axiosLiveInstance.post(`/api/projects/${id}/functions/logs`, { limit: 10, ...type === 'paginate' && { nextKey: logsNextKey }, functionName })
    if (type === 'initial') {
      dispatch(projectsSlice.actions.setLogs({ logs: resp.data.logs }))
    } else {
      dispatch(projectsSlice.actions.appendLogs({ logs: resp.data.logs }))
    }
    dispatch(projectsSlice.actions.setLogsNextKey({ logsNextKey: resp.data.nextKey }))
  } catch (err) {
    toast.error('We could not fetch the logs for this function. Please try again later.')
  } finally {
    if (type === 'initial') {
      dispatch(projectsSlice.actions.setLogsLoading({ logsLoading: false }));
    } else {
      dispatch(projectsSlice.actions.setLoadingMoreLogs({ loadingMoreLogs: false }));
    }
  }
};

export const clearPredictionResults = () => async (dispatch) => {
  dispatch(projectsSlice.actions.setPredictingResults({ predictingResults: [] }));
}

export const createWarmer = (functionName, time) => async (dispatch, getState) => {
  const { project: { id }, functions } = getState().projects;
  const functionToWarm = functions.find((f) => f.name === functionName);

  const { id: functionId, arn, } = functionToWarm;

  const payload = {
    functionName,
    invocationTime: time,
    functionId,
    functionArn: arn
  };

  dispatch(projectsSlice.actions.setCreatingWarmer({ creatingWarmer: true }));
  try {
    const resp = await axiosLiveInstance.post(`/api/projects/${id}/functions/warm`, payload)
    dispatch(projectsSlice.actions.updateFunction({ function: { ...functionToWarm, ...resp.data } }))
    toast.success('We have created a schedule that will warm the function.')
  } catch (err) {
    toast.error('We could not warm the function. Please try again later.')
  } finally {
    dispatch(projectsSlice.actions.setCreatingWarmer({ creatingWarmer: false }));
  }
}  