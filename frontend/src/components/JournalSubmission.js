// import React, { useState, useEffect } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { toast } from 'react-toastify';
// import api from '../services/api';
// import './JournalSubmission.css';

// const JournalSubmission = () => {
//     const navigate = useNavigate();
//     const [submissions, setSubmissions] = useState([]);
//     const [formData, setFormData] = useState({
//         title: '',
//         abstract: '',
//         keywords: '',
//         author: '',
//         wordFileUrl: ''
//     });
//     const [editingId, setEditingId] = useState(null);
//     const [error, setError] = useState('');
//     const [loading, setLoading] = useState(true);

//     useEffect(() => {
//         fetchSubmissions();
//     }, []);

//     const fetchSubmissions = async () => {
//         setLoading(true);
//         setError('');
//         try {
//             const { data } = await api.get('/submissions', {
//                 params: { sortBy: 'createdAt', order: 'desc' }
//             });
//             setSubmissions(data.submissions || []);

//         } catch (err) {
//             const errorMessage = err.response?.data?.message || 'Failed to fetch submissions';
//             setError(errorMessage);
//             toast.error(errorMessage);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleChange = (e) => {
//         setFormData({ ...formData, [e.target.name]: e.target.value });
//     };

//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         setLoading(true);
//         try {
//             if (editingId) {
//                 await api.put(`/submissions/${editingId}`, formData);
//                 toast.success('Submission updated successfully');
//             } else {
//                 await api.post('/submissions', formData);
//                 toast.success('Journal submitted successfully');
//             }
//             setFormData({ title: '', abstract: '', keywords: '', author: '', wordFileUrl: '' });
//             setEditingId(null);
//             fetchSubmissions();
//         } catch (err) {
//             const errorMessage = err.response?.data?.message || 'Submission failed';
//             toast.error(errorMessage);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleEdit = (submission) => {
//         setFormData({
//             title: submission.title,
//             abstract: submission.abstract,
//             keywords: Array.isArray(submission.keywords) ? submission.keywords.join(', ') : submission.keywords,
//             author: submission.author,
//             wordFileUrl: submission.wordFileUrl
//         });
//         setEditingId(submission._id);
//     };

//     const handleDelete = async (id) => {
//         try {
//             await api.delete(`/submissions/${id}`);
//             toast.success('Submission deleted successfully');
//             fetchSubmissions();
//         } catch (err) {
//             const errorMessage = err.response?.data?.message || 'Failed to delete submission';
//             toast.error(errorMessage);
//         }
//     };

//     if (loading) return <div className="loading-spinner">Loading...</div>;


//     return (
//         <div className="journal-submission-container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
//             <div className="header flex flex-col sm:flex-row justify-between items-center mb-6">
//                 <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Journal Submissions</h2>
//                 <Link 
//                     to="/journals" 
//                     className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
//                 >
//                     + New Submission
//                 </Link>
//             </div>

//             {error && (
//                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
//                     <span className="block sm:inline">{error}</span>
//                 </div>
//             )}

//             <form onSubmit={handleSubmit} className="mb-6 bg-white p-6 rounded-lg shadow-md">
//                 <div className="mb-4">
//                     <label className="block text-gray-700 mb-2">Title</label>
//                     <input 
//                         type="text" 
//                         name="title" 
//                         value={formData.title} 
//                         onChange={handleChange} 
//                         placeholder="Journal Title" 
//                         className="w-full p-2 border rounded-md"
//                         required 
//                     />
//                 </div>
//                 <div className="mb-4">
//                     <label className="block text-gray-700 mb-2">Abstract</label>
//                     <textarea 
//                         name="abstract" 
//                         value={formData.abstract} 
//                         onChange={handleChange} 
//                         placeholder="Journal Abstract" 
//                         className="w-full p-2 border rounded-md h-32"
//                         required 
//                     />
//                 </div>
//                 <div className="mb-4">
//                     <label className="block text-gray-700 mb-2">Keywords (comma separated)</label>
//                     <input 
//                         type="text" 
//                         name="keywords" 
//                         value={formData.keywords} 
//                         onChange={handleChange} 
//                         placeholder="e.g. science, research, medicine" 
//                         className="w-full p-2 border rounded-md"
//                         required 
//                     />
//                 </div>
//                 <div className="mb-4">
//                     <label className="block text-gray-700 mb-2">Author</label>
//                     <input 
//                         type="text" 
//                         name="author" 
//                         value={formData.author} 
//                         onChange={handleChange} 
//                         placeholder="Author Name" 
//                         className="w-full p-2 border rounded-md"
//                         required 
//                     />
//                 </div>
//                 <div className="mb-4">
//                     <label className="block text-gray-700 mb-2">Word File URL</label>
//                     <input 
//                         type="text" 
//                         name="wordFileUrl" 
//                         value={formData.wordFileUrl} 
//                         onChange={handleChange} 
//                         placeholder="URL to the Word document" 
//                         className="w-full p-2 border rounded-md"
//                         required 
//                     />
//                 </div>
//                 <button 
//                     type="submit" 
//                     className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
//                     disabled={loading}
//                 >
//                     {loading ? 'Processing...' : (editingId ? 'Update Submission' : 'Submit Journal')}
//                 </button>
//             </form>

//             <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Submissions</h3>
            
//             {submissions.length === 0 ? (
//                 <div className="text-center py-10 text-gray-500">
//                     <p className="text-lg">No submissions available</p>
//                     <p className="mt-2">Submit your first journal above!</p>
//                 </div>
//             ) : (
//                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//                     {submissions.map(submission => (
//                         <div key={submission._id} className="submission-card border rounded-lg p-4 hover:shadow-md transition-shadow">
//                             <h3 className="text-lg font-semibold text-blue-600">
//                                 {submission.title}
//                             </h3>
//                             <p className="text-gray-600 mt-2 line-clamp-2">{submission.abstract}</p>
//                             <div className="mt-2 text-sm text-gray-500">
//                                 Author: {submission.author}
//                             </div>
//                             <div className="actions mt-4 flex flex-wrap gap-2">
//                                 <button 
//                                     onClick={() => handleEdit(submission)} 
//                                     className="text-blue-500 hover:text-blue-700"
//                                 >
//                                     Edit
//                                 </button>
//                                 <button 
//                                     onClick={() => handleDelete(submission._id)} 
//                                     className="text-red-500 hover:text-red-700"
//                                 >
//                                     Delete
//                                 </button>
//                             </div>
//                         </div>
//                     ))}
//                 </div>
//             )}
//         </div>
//     );
// };

// export default JournalSubmission;

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import './JournalSubmission.css';

const JournalSubmission = () => {
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        abstract: '',
        keywords: '',
        author: '',
        wordFileUrl: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/submissions', {
                params: { sortBy: 'createdAt', order: 'desc' }
            });
            
            // Ensure we always have an array, handling different response structures
            const submissionsData = Array.isArray(response.data) 
                ? response.data 
                : (response.data?.submissions || []);
                
            setSubmissions(submissionsData);


        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to fetch submissions';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await api.put(`/submissions/${editingId}`, formData);
                toast.success('Submission updated successfully');
            } else {
                await api.post('/submissions', formData);
                toast.success('Journal submitted successfully');
            }
            setFormData({ title: '', abstract: '', keywords: '', author: '', wordFileUrl: '' });
            setEditingId(null);
            fetchSubmissions();
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Submission failed';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (submission) => {
        setFormData({
            title: submission.title,
            abstract: submission.abstract,
            keywords: Array.isArray(submission.keywords) ? submission.keywords.join(', ') : submission.keywords,
            author: submission.author,
            wordFileUrl: submission.wordFileUrl
        });
        setEditingId(submission._id);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/submissions/${id}`);
            toast.success('Submission deleted successfully');
            fetchSubmissions();
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to delete submission';
            toast.error(errorMessage);
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;
    if (!Array.isArray(submissions)) {
        return (
            <div className="error-message">
                Error: Invalid submissions data format
            </div>
        );
    }



    return (
        <div className="journal-submission-container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="header flex flex-col sm:flex-row justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Journal Submissions</h2>
                <Link 
                    to="/journals" 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    + New Submission
                </Link>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="mb-6 bg-white p-6 rounded-lg shadow-md">
                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Title</label>
                    <input 
                        type="text" 
                        name="title" 
                        value={formData.title} 
                        onChange={handleChange} 
                        placeholder="Journal Title" 
                        className="w-full p-2 border rounded-md"
                        required 
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Abstract</label>
                    <textarea 
                        name="abstract" 
                        value={formData.abstract} 
                        onChange={handleChange} 
                        placeholder="Journal Abstract" 
                        className="w-full p-2 border rounded-md h-32"
                        required 
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Keywords (comma separated)</label>
                    <input 
                        type="text" 
                        name="keywords" 
                        value={formData.keywords} 
                        onChange={handleChange} 
                        placeholder="e.g. science, research, medicine" 
                        className="w-full p-2 border rounded-md"
                        required 
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Author</label>
                    <input 
                        type="text" 
                        name="author" 
                        value={formData.author} 
                        onChange={handleChange} 
                        placeholder="Author Name" 
                        className="w-full p-2 border rounded-md"
                        required 
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Word File URL</label>
                    <input 
                        type="text" 
                        name="wordFileUrl" 
                        value={formData.wordFileUrl} 
                        onChange={handleChange} 
                        placeholder="URL to the Word document" 
                        className="w-full p-2 border rounded-md"
                        required 
                    />
                </div>
                <button 
                    type="submit" 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    disabled={loading}
                >
                    {loading ? 'Processing...' : (editingId ? 'Update Submission' : 'Submit Journal')}
                </button>
            </form>

            <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Submissions</h3>
            
            {submissions.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <p className="text-lg">No submissions available</p>
                    <p className="mt-2">Submit your first journal above!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submissions.map(submission => (
                        <div key={submission._id} className="submission-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-semibold text-blue-600">
                                {submission.title}
                            </h3>
                            <p className="text-gray-600 mt-2 line-clamp-2">{submission.abstract}</p>
                            <div className="mt-2 text-sm text-gray-500">
                                Author: {submission.author}
                            </div>
                            <div className="actions mt-4 flex flex-wrap gap-2">
                                <button 
                                    onClick={() => handleEdit(submission)} 
                                    className="text-blue-500 hover:text-blue-700"
                                >
                                    Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(submission._id)} 
                                    className="text-red-500 hover:text-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JournalSubmission;
