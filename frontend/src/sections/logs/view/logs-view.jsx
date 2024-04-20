import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { LoadingButton } from '@mui/lab';
import { Box, Container, Typography, CircularProgress } from '@mui/material';

import { getLogsForFunction, predictInvocationTimesForFunctions } from 'src/redux/slices/projects';

import { LogCard } from 'src/sections/logs/log-card';

const LogsView = () => {
  const dispatch = useDispatch();
  const {
    logs = [],
    logsLoading,
    loadingMoreLogs,
    logsNextKey,
    predicting,
  } = useSelector((state) => state.projects);
  const { functionName } = useParams();

  console.log({ logs });

  useEffect(() => {
    dispatch(getLogsForFunction(functionName, 'initial'));
  }, [dispatch, functionName]);

  const loadMoreLogs = () => {
    dispatch(getLogsForFunction(functionName, 'paginate'));
  };

  const handlePredictNextInvocationClick = () => {
    dispatch(predictInvocationTimesForFunctions([functionName]));
  };

  return (
    <Container>
      <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4">Functions Logs</Typography>
          <Typography variant="caption">
            Function Logs: {functionName} | CloudWatch Stream - /aws/lambda/{functionName}
          </Typography>
        </Box>
        <LoadingButton
          onClick={handlePredictNextInvocationClick}
          loading={predicting}
          variant="contained"
          size="small"
          sx={{ ml: 'auto' }}
        >
          Predict Next Invocation
        </LoadingButton>
      </Box>

      {logsLoading ? (
        <Box sx={{ my: 15, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ my: 2 }}>
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
          {logsNextKey && (
            <Box sx={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
              <LoadingButton
                onClick={loadMoreLogs}
                loading={loadingMoreLogs}
                variant="contained"
                size="small"
              >
                Load More
              </LoadingButton>
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
};

export default LogsView;
