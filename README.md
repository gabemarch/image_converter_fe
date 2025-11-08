# Frontend - AVIF to PNG Converter

Next.js frontend for the image converter application.

## Features

- ✅ Drag & drop file upload
- ✅ File picker alternative
- ✅ Real-time conversion status
- ✅ Download converted PNG files
- ✅ Error handling with user-friendly messages
- ✅ Responsive design (mobile & desktop)
- ✅ Dark mode support
- ✅ File validation (type & size)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file (optional):
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` if needed:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

4. Run development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Project Structure

```
frontend/
├── app/
│   ├── components/
│   │   ├── FileUpload.tsx       # File upload with drag & drop
│   │   ├── ConversionStatus.tsx # Status display component
│   │   └── DownloadButton.tsx   # Download button component
│   ├── lib/
│   │   └── api.ts               # API client functions
│   ├── types/
│   │   └── converter.ts         # TypeScript type definitions
│   ├── page.tsx                 # Main page
│   ├── layout.tsx               # Root layout
│   └── globals.css               # Global styles
├── public/                       # Static assets
└── package.json
```

## Components

### FileUpload
Handles file selection via drag & drop or file picker. Includes:
- File validation (type & size)
- Visual feedback
- Error messages
- File info display

### ConversionStatus
Displays conversion progress and status:
- Uploading state
- Processing state
- Success state
- Error state with messages

### DownloadButton
Handles PNG file download:
- Automatic filename generation
- Blob URL management
- Clean download experience

## API Integration

The frontend communicates with the backend API at:
- Default: `http://localhost:8000`
- Configurable via `NEXT_PUBLIC_API_URL`

### Endpoints Used
- `POST /api/convert` - Convert AVIF to PNG
- `GET /health` - Health check (via API client)

## Development

### Build for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Features in Detail

### File Upload
- Maximum file size: 10MB (configurable)
- Supported formats: `.avif`, `.avifs`
- Client-side validation before upload
- Visual drag & drop feedback

### Conversion Flow
1. User selects/ drops AVIF file
2. File is validated
3. File is uploaded to backend
4. Backend converts AVIF to PNG
5. PNG file is downloaded automatically

### Error Handling
- Network errors
- File validation errors
- Server errors
- User-friendly error messages

## Styling

Uses Tailwind CSS for styling with:
- Responsive design utilities
- Dark mode support
- Modern UI components
- Smooth animations and transitions
