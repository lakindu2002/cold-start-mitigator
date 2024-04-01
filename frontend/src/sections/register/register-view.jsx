import * as Yup from 'yup';
import { useState } from 'react';
import { useFormik } from 'formik';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha, useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';

import { bgGradient } from 'src/theme/css';
import { useAuth } from 'src/contexts/auth-context';

import Logo from 'src/components/logo';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

export default function RegisterView() {
  const theme = useTheme();

  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const { register } = useAuth();

  const form = useFormik({
    initialValues: {
      name: '',
      email: '',
      password: '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().required('Full name is required'),
      email: Yup.string().email('Email is invalid').required('Email is required'),
      password: Yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      const { email, name, password } = values;
      try {
        await register(email, password, name);
        navigate(`/confirm-account?email=${email}`);
      } catch (err) {
        if (err.name === 'UsernameExistsException') {
          toast.error('There is already an account with this given email');
        } else if (err.name === 'InvalidPasswordException') {
          toast.error('Password should be minimum 8 characters');
        } else {
          toast.error('We ran into an error while creating your account. Please try again');
        }
      }
    },
  });

  const renderForm = (
    <>
      <Stack spacing={3}>
        <TextField
          name="name"
          label="Full Name"
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          onReset={form.handleReset}
          error={Boolean(form.touched.name && form.errors.name)}
          helperText={form.touched.name && form.errors.name}
        />

        <TextField
          name="email"
          label="Email address"
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          onReset={form.handleReset}
          error={Boolean(form.touched.email && form.errors.email)}
          helperText={form.touched.email && form.errors.email}
        />

        <TextField
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          onBlur={form.handleBlur}
          onChange={form.handleChange}
          onReset={form.handleReset}
          error={Boolean(form.touched.password && form.errors.password)}
          helperText={form.touched.password && form.errors.password}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  <Iconify icon={showPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ my: 3 }}>
        <Link variant="subtitle2" underline="hover" href="/login">
          Already have an account?
        </Link>
      </Stack>

      <LoadingButton
        loading={form.isSubmitting}
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        color="inherit"
      >
        Get Started
      </LoadingButton>
    </>
  );

  return (
    <Box
      sx={{
        ...bgGradient({
          color: alpha(theme.palette.background.default, 0.9),
          imgUrl: '/assets/background/overlay_4.jpg',
        }),
        height: 1,
      }}
    >
      <Logo
        sx={{
          position: 'fixed',
          top: { xs: 16, md: 24 },
          left: { xs: 16, md: 24 },
        }}
      />

      <Stack alignItems="center" justifyContent="center" sx={{ height: 1 }}>
        <Card
          sx={{
            p: 5,
            width: 1,
            maxWidth: 420,
          }}
        >
          <Typography variant="h4">Create Account on HeatShield</Typography>

          <Box sx={{ mt: 3 }}>
            <form onSubmit={form.handleSubmit} noValidate>
              {renderForm}
            </form>
          </Box>
        </Card>
      </Stack>
    </Box>
  );
}
