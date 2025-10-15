# Random User API Reference

## 🌐 API Overview

**Base URL**: `https://randomuser.me/api/`

**Rate Limit**: 100 requests per minute (free tier)

**Authentication**: None required

**Response Format**: JSON

## 📋 Basic Usage

### Simple Request

```bash
curl "https://randomuser.me/api/"
```

Returns 1 random user with all fields.

### Request Multiple Users

```bash
curl "https://randomuser.me/api/?results=10"
```

Returns 10 random users.

## 🔧 Parameters

### `results`
Number of users to generate (1-5000)

```bash
?results=25
```

### `gender`
Filter by gender

```bash
?gender=female
?gender=male
```

### `nat`
Filter by nationality (comma-separated)

```bash
?nat=US
?nat=US,GB,FR
```

Available nationalities:
- `AU` - Australia
- `BR` - Brazil
- `CA` - Canada
- `CH` - Switzerland
- `DE` - Germany
- `DK` - Denmark
- `ES` - Spain
- `FI` - Finland
- `FR` - France
- `GB` - United Kingdom
- `IE` - Ireland
- `IN` - India
- `IR` - Iran
- `MX` - Mexico
- `NL` - Netherlands
- `NO` - Norway
- `NZ` - New Zealand
- `RS` - Serbia
- `TR` - Turkey
- `UA` - Ukraine
- `US` - United States

### `inc`
Include only specific fields

```bash
?inc=name,email,phone
```

Available fields:
- `gender`
- `name`
- `location`
- `email`
- `login`
- `registered`
- `dob`
- `phone`
- `cell`
- `id`
- `picture`
- `nat`

### `exc`
Exclude specific fields

```bash
?exc=login,registered
```

### `seed`
Generate reproducible results

```bash
?seed=myseed123
```

Same seed always returns same users.

### `format`
Response format (default: json)

```bash
?format=json
?format=csv
?format=yaml
```

## 📦 Response Structure

### Full JSON Response

```json
{
  "results": [
    {
      "gender": "female",
      "name": {
        "title": "Miss",
        "first": "Jennie",
        "last": "Nichols"
      },
      "location": {
        "street": {
          "number": 8929,
          "name": "Valwood Pkwy"
        },
        "city": "Billings",
        "state": "Michigan",
        "country": "United States",
        "postcode": "63104",
        "coordinates": {
          "latitude": "-69.8246",
          "longitude": "134.8719"
        },
        "timezone": {
          "offset": "+9:30",
          "description": "Adelaide, Darwin"
        }
      },
      "email": "jennie.nichols@example.com",
      "login": {
        "uuid": "7a0eed16-9430-4d68-901f-c0d4c1c3bf00",
        "username": "yellowpeacock117",
        "password": "addison",
        "salt": "sld1yGtd",
        "md5": "ab54ac4c0be9480ae8fa5e9e2a5196a3",
        "sha1": "edcf2ce613cbdea349133c52dc2f3b83168dc51b",
        "sha256": "48df5229235ada28389b91e60a935e4f9b73eb4bdb855ef9258a1751f10bdc5d"
      },
      "dob": {
        "date": "1992-03-08T15:13:16.688Z",
        "age": 30
      },
      "registered": {
        "date": "2007-07-09T05:51:59.390Z",
        "age": 14
      },
      "phone": "(272) 790-0888",
      "cell": "(489) 330-2385",
      "id": {
        "name": "SSN",
        "value": "405-88-3636"
      },
      "picture": {
        "large": "https://randomuser.me/api/portraits/men/75.jpg",
        "medium": "https://randomuser.me/api/portraits/med/men/75.jpg",
        "thumbnail": "https://randomuser.me/api/portraits/thumb/men/75.jpg"
      },
      "nat": "US"
    }
  ],
  "info": {
    "seed": "56d27f4a53bd5441",
    "results": 1,
    "page": 1,
    "version": "1.4"
  }
}
```

## 🎯 Our Pipeline Usage

### Current Configuration

```yaml
uri: https://randomuser.me/api/
options:
  results: "{{ inputs.batch_size }}"  # 10 by default
  inc: "gender,name,email,login,dob,registered,phone,cell,picture,location,nat"
```

### Why These Fields?

- **login.uuid**: Unique identifier for deduplication
- **name**: User demographics
- **email**: Contact information
- **dob**: Age analytics
- **location**: Geographic distribution
- **picture**: Visual dashboard elements
- **phone/cell**: Contact details
- **registered**: User account age
- **nat**: Nationality statistics

## 📊 Field Mapping

### API Field → Database Column

| API Path | Database Column | Type | Notes |
|----------|----------------|------|-------|
| `login.uuid` | `user_id` | VARCHAR(100) | Primary key |
| `gender` | `gender` | VARCHAR(20) | - |
| `name.title` | `title` | VARCHAR(20) | Mr, Mrs, Miss, etc |
| `name.first` | `first_name` | VARCHAR(100) | - |
| `name.last` | `last_name` | VARCHAR(100) | - |
| `email` | `email` | VARCHAR(255) | - |
| `login.username` | `username` | VARCHAR(100) | - |
| `dob.date` | `date_of_birth` | TIMESTAMP | ISO 8601 format |
| `dob.age` | `age` | INT | - |
| `phone` | `phone` | VARCHAR(50) | - |
| `cell` | `cell` | VARCHAR(50) | - |
| `location.street.number` | `street_number` | VARCHAR(20) | - |
| `location.street.name` | `street_name` | VARCHAR(255) | - |
| `location.city` | `city` | VARCHAR(100) | - |
| `location.state` | `state` | VARCHAR(100) | - |
| `location.country` | `country` | VARCHAR(100) | - |
| `location.postcode` | `postcode` | VARCHAR(20) | - |
| `location.coordinates.latitude` | `latitude` | VARCHAR(50) | - |
| `location.coordinates.longitude` | `longitude` | VARCHAR(50) | - |
| `location.timezone.offset` | `timezone_offset` | VARCHAR(20) | e.g., "+5:30" |
| `location.timezone.description` | `timezone_description` | VARCHAR(255) | - |
| `nat` | `nationality` | VARCHAR(10) | 2-letter code |
| `picture.large` | `picture_large` | TEXT | URL |
| `picture.medium` | `picture_medium` | TEXT | URL |
| `picture.thumbnail` | `picture_thumbnail` | TEXT | URL |
| `registered.date` | `registered_date` | TIMESTAMP | - |
| `registered.age` | `registered_age` | INT | - |

## 🚀 Advanced Usage Examples

### Get 50 Female Users from US

```bash
curl "https://randomuser.me/api/?results=50&gender=female&nat=US"
```

### Get Only Contact Info

```bash
curl "https://randomuser.me/api/?inc=name,email,phone,cell"
```

### Exclude Sensitive Data

```bash
curl "https://randomuser.me/api/?exc=login,id"
```

### Reproducible Dataset

```bash
curl "https://randomuser.me/api/?results=100&seed=testdata2024"
```

## ⚠️ Rate Limiting

### Current Pipeline Impact

- **Frequency**: Every 1 minute
- **Batch size**: 10 users
- **Requests per hour**: 60
- **Daily requests**: ~1,440
- **Well within limit**: ✅ (100 req/min = 6,000 req/hour)

### Recommended Scaling

| Scenario | Frequency | Batch Size | Req/Hour | Status |
|----------|-----------|------------|----------|--------|
| Testing | Every 30s | 5 | 120 | ✅ Safe |
| Normal | Every 1min | 10 | 60 | ✅ Safe |
| Heavy | Every 1min | 50 | 60 | ✅ Safe |
| Aggressive | Every 30s | 100 | 240 | ⚠️ Monitor |
| Extreme | Every 15s | 100 | 480 | ❌ Risk |

## 🧪 Testing Commands

### Test API Availability

```powershell
curl "https://randomuser.me/api/?results=1"
```

### Test Specific Fields

```powershell
curl "https://randomuser.me/api/?inc=name,email&results=1"
```

### Test Nationality Filter

```powershell
curl "https://randomuser.me/api/?nat=US,GB&results=5"
```

### Measure Response Time

```powershell
Measure-Command { curl "https://randomuser.me/api/?results=100" }
```

## 📖 Additional Resources

- **Official Docs**: https://randomuser.me/documentation
- **API Status**: https://randomuser.me/
- **GitHub**: https://github.com/RandomAPI/Randomuser.me-Node

## 🔍 Data Quality Notes

### Known Characteristics

- **Realistic Data**: Names, addresses, emails are plausible but fictional
- **Consistency**: Phone formats match country
- **Variety**: Good distribution across demographics
- **Pictures**: AI-generated faces (https://thispersondoesnotexist.com)

### Not Suitable For

- Production user authentication
- Real contact information
- Legal/compliance testing requiring real data
- Machine learning models requiring verified ground truth

### Ideal For

- ✅ Dashboard prototyping
- ✅ Load testing ETL pipelines
- ✅ UI/UX development
- ✅ Database schema validation
- ✅ Reporting template creation
