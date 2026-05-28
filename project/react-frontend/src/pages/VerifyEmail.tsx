import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyApi } from '@/services/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    verifyApi.verify(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch(() => {
        setStatus('error');
        setMessage('Invalid or expired verification token.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-primary">
      <div className="card p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-theme-primary">Verifying your email...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-theme-primary mb-2">Email Verified!</h2>
            <p className="text-theme-secondary mb-6">{message}</p>
            <Link to="/login" className="btn-primary inline-block px-6 py-2">
              Sign In
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-theme-primary mb-2">Verification Failed</h2>
            <p className="text-theme-secondary mb-6">{message}</p>
            <Link to="/login" className="btn-primary inline-block px-6 py-2">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
