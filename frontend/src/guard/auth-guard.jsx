import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from 'src/contexts/auth-context';

const unprotectedRoutes = [
  '/login',
  '/register',
  '/confirm-account',
  '/reset-password',
  '/',
  '/create-project',
  '/password-recovery',
];

export const AuthGuard = (props) => {
  const { children } = props;
  const { isAuthenticated, isLoggedOut, user } = useAuth();
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const authorizeUser = useCallback(async () => {
    if (unprotectedRoutes.includes(pathname) && !isAuthenticated) {
      setChecked(true);
      return;
    }

    if (!isAuthenticated && !unprotectedRoutes.includes(pathname)) {
      navigate('/login');
    } else {
      if (pathname === '/create-project') {
        setChecked(true);
        return;
      }

      if (user.projects.length > 0 && !user?.currentProject) {
        const firstProjectId = user.projects[0].id;
        const projectId = user?.currentProject?.id || firstProjectId;
        navigate(`/projects/${projectId}`);
      } else if (user?.currentProject) {
        // get the project id from the URL
        const projectId = pathname.split('/')[2];
        const project = user.projects.find((p) => p.id === projectId);
        if (!project) {
          navigate(`/projects/${user.projects[0].id}`);
        } else {
          setChecked(true);
        }
      } else {
        navigate(`/create-project`);
      }
      setChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, pathname, user?.projects]);

  useEffect(() => {
    authorizeUser();
  }, [authorizeUser]);

  if (isLoggedOut) {
    navigate('/');
  }

  if (!checked) {
    return null;
  }

  // If got here, it means that the redirect did not occur, and that tells us that the user is
  // authenticated / authorized.

  return <>{children}</>;
};

AuthGuard.propTypes = {
  children: PropTypes.node,
};
