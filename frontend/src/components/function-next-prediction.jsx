import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LoadingButton } from '@mui/lab';
import {
  Box,
  Dialog,
  Button,
  Divider,
  IconButton,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
} from '@mui/material';

import { createWarmer, clearPredictionResults } from 'src/redux/slices/projects';

import Iconify from './iconify';

export const FunctionNextPrediction = () => {
  const { predictingResults, creatingWarmer } = useSelector((state) => state.projects);
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (predictingResults.length > 0) {
      setOpen(true);
    }
  }, [predictingResults.length]);

  if (predictingResults.length === 0) {
    return null;
  }

  const toggleOpen = () => {
    setOpen(!open);
    dispatch(clearPredictionResults());
  };

  const handleWarmFunction = (functionName, time) => {
    dispatch(createWarmer(functionName, time));
  };

  return (
    <Dialog open={open} onClose={toggleOpen} maxWidth="sm">
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Prediction Results From Your Model</Typography>
          <IconButton onClick={toggleOpen}>
            <Iconify icon="eva:close-fill" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {predictingResults.map((result) => (
          <Box key={result.id}>
            <Typography>
              Function Name - {result.functionName} |{' '}
              <b>
                {result.message
                  ? result.message
                  : `Next Invocation Time: ${format(result.time, 'yyyy-MM-dd HH:mm:ss')}`}{' '}
              </b>
            </Typography>
            <LoadingButton
              variant="contained"
              loading={creatingWarmer}
              disabled={creatingWarmer || !result.time}
              onClick={() => handleWarmFunction(result.functionName, result.time)}
            >
              Create Warmer
            </LoadingButton>
            <Divider sx={{ my: 2 }} />
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={toggleOpen}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
