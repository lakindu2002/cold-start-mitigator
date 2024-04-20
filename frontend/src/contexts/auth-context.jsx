/* eslint-disable react/jsx-no-constructed-context-values */
import PropTypes from 'prop-types';
/* eslint-disable no-undef */
import { Amplify } from 'aws-amplify';
import { useDispatch } from 'react-redux';
import { useEffect, useReducer, useContext, useCallback, createContext } from 'react';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resetPassword,
  resendSignUpCode,
  confirmResetPassword,
  updatePassword as updatedPasswordAmplify,
} from 'aws-amplify/auth';

import axios from 'src/lib/axios';
import { amplifyConfig } from 'src/config';
import { setProject } from 'src/redux/slices/projects';
import toast from 'react-hot-toast';

Amplify.configure(amplifyConfig);

const initialState = {
  isAuthenticated: false,
  isInitialized: false,
  user: null,
  isLoggedOut: false,
};

const handlers = {
  INITIALIZE: (state, action) => {
    const { isAuthenticated, user } = action.payload;

    return {
      ...state,
      isAuthenticated,
      isInitialized: true,
      user,
      isLoggedOut: false,
    };
  },
  LOGIN: (state, action) => {
    const { user } = action.payload;

    return {
      ...state,
      isAuthenticated: true,
      user,
      isLoggedOut: false,
    };
  },
  LOGOUT: (state) => ({
    ...state,
    isAuthenticated: false,
    user: null,
    isLoggedOut: true,
    isInitialized: true,
  }),
  UPDATE_USER: (state, action) => {
    const { patchAttr } = action.payload;
    return {
      ...state,
      isAuthenticated: true,
      isLoggedOut: false,
      user: { ...state.user, ...patchAttr },
    };
  },
  REGISTER: (state) => ({ ...state }),
  VERIFY_CODE: (state) => ({ ...state }),
  RESEND_CODE: (state) => ({ ...state }),
  PASSWORD_RECOVERY: (state) => ({ ...state }),
  RESET_DEFAULT_PASSWORD: (state) => ({ ...state }),
  PASSWORD_RESET: (state) => ({ ...state }),
  UPDATE_PASSWORD: (state) => ({ ...state }),
};

const reducer = (state, action) =>
  handlers[action.type] ? handlers[action.type](state, action) : state;

export const AuthContext = createContext({
  ...initialState,
  platform: 'Amplify',
  login: (message) => Promise.resolve({ message }),
  logout: () => Promise.resolve(),
  register: () => Promise.resolve(),
  verifyCode: () => Promise.resolve(),
  resendCode: () => Promise.resolve(),
  passwordRecovery: () => Promise.resolve(),
  passwordReset: () => Promise.resolve(),
  resetDefaultPassword: () => Promise.resolve(),
  updatePassword: () => Promise.resolve(),
  refreshToken: () => Promise.resolve(),
  reloadUser: () => Promise.resolve(),
  changeEntity: () => Promise.resolve(),
});

const loadUserData = async () => {
  const response = await axios.get('/api/account');
  const { projects, id, fullName, email } = response.data;

  return {
    projects,
    id,
    fullName,
    email,
  };
};

const getProjectInformation = async (projectId) => {
  const resp = await axios.get(`/api/projects/${projectId}`);
  return resp.data.project;
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toolkitDispatch = useDispatch();

  const getCurrentProject = useCallback(async (user) => {
    if (user.projects.length === 0) {
      return undefined;
    }
    const currentProjectId = user.projects[0].id;
    const resp = await getProjectInformation(currentProjectId);
    return resp;
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const user = await loadUserData();
        const currentProject = await getCurrentProject(user);
        dispatch({
          type: 'INITIALIZE',
          payload: {
            isAuthenticated: true,
            user: {
              ...user,
              currentProject,
            },
          },
        });
      } catch (error) {
        dispatch({
          type: 'INITIALIZE',
          payload: {
            isAuthenticated: false,
            user: null,
          },
        });
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCurrentProject]);

  const refreshToken = async () => {
    // TODO: Implement
  };

  const login = async (email, password) => {
    const user = await signIn({ username: email, password });
    if (user.challengeName) {
      console.error(
        `Unable to login, because challenge "${user.challengeName}" is mandated and we did not handle this case.`
      );
      return { message: user.challengeName };
    }
    const userData = await loadUserData();
    const currentWorkspace = await getCurrentProject(userData);
    dispatch({
      type: 'INITIALIZE',
      payload: {
        user: { ...userData, currentWorkspace },
        isAuthenticated: true,
      },
    });
    return { message: currentWorkspace?.workspaceId };
  };

  const logout = async () => {
    await signOut({ global: true });
    dispatch({
      type: 'LOGOUT',
    });
  };

  const register = async (email, password, fullName) => {
    const authAttributes = {
      email: email.toLowerCase().trim(),
      name: fullName.trim(),
    };
    await signUp({
      username: email.toLowerCase().trim(),
      password,
      attributes: authAttributes,
    });
    dispatch({
      type: 'REGISTER',
    });
  };

  const verifyCode = async (username, code) => {
    await confirmSignUp({ username, confirmationCode: code });
    dispatch({
      type: 'VERIFY_CODE',
    });
  };

  const resendCode = async (username) => {
    await resendSignUpCode({ username });
    dispatch({
      type: 'RESEND_CODE',
    });
  };

  const passwordRecovery = async (username) => {
    const output = await resetPassword({ username });

    const { nextStep } = output;
    switch (nextStep.resetPasswordStep) {
      case 'CONFIRM_RESET_PASSWORD_WITH_CODE':
        // eslint-disable-next-line no-case-declarations
        const { codeDeliveryDetails } = nextStep;
        toast.success(`Confirmation code was sent to ${codeDeliveryDetails.deliveryMedium}`);
        // Collect the confirmation code from the user and pass to confirmResetPassword.
        break;
      case 'DONE':
        console.log('Successfully reset password.');
        break;
      default:
        console.log('Default');
    }

    dispatch({
      type: 'PASSWORD_RECOVERY',
    });
  };

  async function passwordReset({ username, confirmationCode, newPassword }) {
    try {
      await confirmResetPassword({ username, confirmationCode, newPassword });
      dispatch({
        type: 'PASSWORD_RESET',
      });
      toast.success('Password reset successfully');
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  const updatePassword = async (oldPassword, newPassword) => {
    await updatedPasswordAmplify({ newPassword, oldPassword });
    dispatch({
      type: 'UPDATE_PASSWORD',
    });
  };

  const reloadUser = async () => {
    const userInfo = await loadUserData();
    dispatch({
      type: 'INITIALIZE',
      payload: {
        isAuthenticated: true,
        user: userInfo,
      },
    });
  };

  const changeEntity = async (id) => {
    const project = await getProjectInformation(id);
    await toolkitDispatch(setProject(project));
    dispatch({
      type: 'UPDATE_USER',
      payload: {
        patchAttr: {
          currentProject: project,
        },
      },
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        platform: 'Amplify',
        login,
        logout,
        register,
        verifyCode,
        resendCode,
        passwordRecovery,
        passwordReset,
        updatePassword,
        refreshToken,
        reloadUser,
        changeEntity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const AuthConsumer = AuthContext.Consumer;
export const useAuth = () => useContext(AuthContext);
