import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../syles/FileUpload.css";

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [fileValidationErrors, setFileValidationErrors] = useState([]);
  const navigate = useNavigate();

  // Reset status messages when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any file previews to avoid memory leaks
      files.forEach((file) => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
    };
  }, [files]);

  const { getRootProps, getInputProps, fileRejections } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxSize: 15728640, // 15MB max file size
    maxFiles: 5, // Maximum 5 files at once
    onDrop: (acceptedFiles) => {
      setFileValidationErrors([]);
      setFiles(
        acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
            status: "ready",
          })
        )
      );
    },
    onDropRejected: (rejectedFiles) => {
      const errors = rejectedFiles.map((rejection) => {
        if (rejection.errors[0].code === "file-too-large") {
          return `${rejection.file.name} is too large. Maximum size is 15MB.`;
        } else if (rejection.errors[0].code === "file-invalid-type") {
          return `${rejection.file.name} has an invalid file type. Only PDF, CSV, TXT, XLS, and XLSX are accepted.`;
        } else {
          return `${rejection.file.name}: ${rejection.errors[0].message}`;
        }
      });
      setFileValidationErrors(errors);
    },
  });

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadStatus({
        type: "error",
        message: "Please select at least one file to upload.",
      });
      return;
    }

    setUploading(true);
    setUploadStatus({ type: "info", message: "Uploading files..." });
    setProgress(0);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("statements", file);
    });

    try {
      // Upload files with progress tracking
      const uploadResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          },
        }
      );

      setUploadStatus({
        type: "success",
        message: "Files uploaded successfully!",
      });
      setProgress(100);

      // Start AI processing
      setProcessingStatus({
        type: "info",
        message: "Processing your statements with AI...",
      });

      try {
        const processResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/process`,
          {
            fileIds: uploadResponse.data.fileIds,
          },
          {
            timeout: 120000, // 2 minute timeout for AI processing
          }
        );

        const transactionCount = processResponse.data.transactionsCount || 0;

        if (transactionCount === 0) {
          setProcessingStatus({
            type: "warning",
            message: "Processing complete, but no transactions were found. Please check your file format and try again.",
          });
        } else {
          setProcessingStatus({
            type: "success",
            message: `Processing complete! ${transactionCount} transactions extracted. Redirecting to dashboard...`,
          });

          // Automatically redirect to dashboard after successful processing
          setTimeout(() => {
            navigate("/");
          }, 2000);
        }
      } catch (processError) {
        console.error("Processing error:", processError);
        
        let errorMessage = "An error occurred during AI processing. Please try again.";
        
        if (processError.code === 'ECONNABORTED') {
          errorMessage = "Processing timeout. Your file might be too large or complex. Please try with a smaller file.";
        } else if (processError.response?.status === 500) {
          errorMessage = processError.response?.data?.message || "Server error during processing. Please check your file format and try again.";
        } else if (processError.response?.status === 400) {
          errorMessage = processError.response?.data?.message || "Invalid file format or content. Please check your file and try again.";
        } else if (processError.response?.data?.message) {
          errorMessage = processError.response.data.message;
        }
        
        setProcessingStatus({
          type: "error",
          message: `Error: ${errorMessage}`,
        });
        // Don't clear files so user can retry processing
      }
    } catch (error) {
      console.error("Upload error:", error);
      setProgress(0);
      setUploadStatus({
        type: "error",
        message:
          error.response?.data?.message ||
          "Error uploading files. Please check your file format and try again.",
      });
      setProcessingStatus(null);
    } finally {
      setUploading(false);
    }
  };

  // Format file size to be more readable
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  // Get appropriate icon for file type
  const getFileIcon = (fileName) => {
    const extension = fileName.split(".").pop().toLowerCase();
    switch (extension) {
      case "pdf":
        return "📄";
      case "csv":
        return "📊";
      case "txt":
        return "📝";
      case "xls":
      case "xlsx":
        return "📑";
      default:
        return "📁";
    }
  };

  const fileList = files.map((file) => (
    <li key={file.name} className="file-item">
      <div className="file-info">
        <span className="file-icon">{getFileIcon(file.name)}</span>
        <span className="file-name">{file.name}</span>
        <span className="file-size">{formatFileSize(file.size)}</span>
      </div>
    </li>
  ));

  return (
    <div className="file-upload-container">
      <h1>Upload Bank Statements</h1>
      <p className="upload-instructions">
        Upload your bank statements in PDF, CSV, TXT, XLS, or XLSX format. Our
        AI will automatically extract and categorize your transactions.
      </p>

      <div
        {...getRootProps({
          className: `dropzone ${uploading ? "disabled" : ""}`,
        })}
      >
        <input {...getInputProps()} disabled={uploading} />
        <div className="dropzone-content">
          <div className="upload-icon">📂</div>
          <p>Drag & drop files here, or click to select files</p>
          <em>
            (PDF, CSV, TXT, XLS, and XLSX files are accepted, max 15MB per file)
          </em>
        </div>
      </div>

      {fileValidationErrors.length > 0 && (
        <div className="validation-errors">
          <h4>File Validation Errors:</h4>
          <ul>
            {fileValidationErrors.map((error, index) => (
              <li key={index} className="error-message">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <div className="file-list-container">
          <h3>
            Selected Files:{" "}
            <span className="file-count">{files.length} file(s)</span>
          </h3>
          <ul className="file-list">{fileList}</ul>
        </div>
      )}

      {progress > 0 && progress < 100 && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{progress}% Uploaded</div>
        </div>
      )}

      <div className="action-buttons">
        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
        >
          {uploading ? "Processing..." : "Upload & Process"}
        </button>

        {files.length > 0 && !uploading && (
          <button
            className="clear-button"
            onClick={() => {
              setFiles([]);
              setFileValidationErrors([]);
              setUploadStatus(null);
              setProcessingStatus(null);
            }}
          >
            Clear Files
          </button>
        )}
      </div>

      {uploadStatus && (
        <div className={`status-message ${uploadStatus.type}`}>
          {uploadStatus.message}
        </div>
      )}

      {processingStatus && (
        <div className={`status-message ${processingStatus.type}`}>
          {processingStatus.message}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
