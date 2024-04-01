import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { Button, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import { bgGradient } from 'src/theme/css';

import Logo from 'src/components/logo';

// ----------------------------------------------------------------------

export default function LandingPage() {
  const theme = useTheme();
  return (
    <>
      <Helmet>
        <title>HeatShield</title>
      </Helmet>
      <Box
        sx={{
          ...bgGradient({
            color: alpha(theme.palette.background.default, 0.9),
            imgUrl: '/assets/background/overlay_4.jpg',
          }),
          height: 1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Card
          sx={{
            p: 5,
            width: '100%',
            height: '50%',
            m: 20,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Logo
              sx={{
                width: 200,
                height: 200,
              }}
            />
          </Box>
          <Typography textAlign="center" color="textSecondary" variant="h3">
            Mitigate your cold starts on AWS Lambda today!
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2, gap: 2 }}>
            <Link to="/login">
              <Button size="large" variant="contained">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button size="large" variant="outlined">
                Register
              </Button>
            </Link>
          </Box>
        </Card>
      </Box>
    </>
  );
}
