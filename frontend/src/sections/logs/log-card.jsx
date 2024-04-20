import { useState } from 'react';
import { format } from 'date-fns';
import PropTypes from 'prop-types';

import {
  Box,
  Card,
  Collapse,
  CardHeader,
  IconButton,
  Typography,
  CardContent,
} from '@mui/material';

import Iconify from 'src/components/iconify';

export const LogCard = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  return (
    <Card sx={{ p: 0, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={handleToggleExpand} sx={{ ml: 1 }}>
          <Iconify
            icon={`eva:${!expanded ? 'arrow-ios-downward-fill' : 'arrow-ios-upward-fill'}`}
          />
        </IconButton>
        <CardHeader
          sx={{
            py: 2,
            pl: 0,
          }}
          title={<>{format(log.startUpTime, 'dd/MM/yyyy hh:mm:ss a')}</>}
          subheader={`Billed Duration - ${log.billedDuration}ms | Memory Used - ${
            log.maxMemoryUsed
          }MB | Cold Start - ${log.isCold ? 'Yes' : 'No'}`}
          titleTypographyProps={{
            variant: 'body1',
            fontWeight: 500,
          }}
        />
      </Box>
      <Collapse in={expanded}>
        <CardContent>
          {log.cycleLogs.map((cycleLog, index) => (
            <Box key={`${cycleLog.eventId}#${index}`} sx={{ my: 1 }}>
              <Typography variant="body2">
                {index + 1}: {cycleLog.message}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Collapse>
    </Card>
  );
};

LogCard.propTypes = {
  log: PropTypes.object.isRequired,
};
