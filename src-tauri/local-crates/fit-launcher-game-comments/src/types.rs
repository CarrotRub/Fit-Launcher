use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Comments {
    pub data: CommentData,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct CommentData {
    pub chat: Chat,
    pub comments: Vec<Comment>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Chat {
    pub site_id: i64,
    pub title: String,
    pub hash: String,
    pub identity: Option<Value>,
    pub url: String,
    pub count_comment_all: i64,
    pub count_comment_load: i64,
    pub closed: bool,
    pub format: i64,
    pub root_id: i64,
    pub fixed_comment: Option<Value>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Comment {
    pub id: i64,
    pub text_template: Option<String>,
    pub data_create: Option<String>,
    pub user: Option<User>,
    pub raiting: Option<Rating>,
    #[serde(default)]
    pub attaches: Vec<Attach>,
    #[serde(default)]
    pub attaches_icons: Vec<Value>,
    pub attaches_text: Option<String>,
    pub sort: Value,
    pub edited: Option<bool>,
    pub fixed: Option<bool>,
    pub comment_type: i64,
    pub answer_comment_root_id: i64,
    pub answer_comment_count: i64,
    pub answer_comment: Option<AnswerComment>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AnswerComment {
    pub id: i64,
    pub text_template: Option<String>,
    pub data_create: Option<String>,
    pub user: Option<User>,
    pub raiting: Option<Rating>,
    #[serde(default)]
    pub attaches: Option<Vec<Attach>>,
    #[serde(default)]
    pub attaches_icons: Option<Vec<i64>>,
    pub attaches_text: Option<String>,
    pub sort: Option<i64>,
    pub edited: Option<bool>,
    pub fixed: Option<bool>,
    pub comment_type: Option<i64>,
    pub answer_comment_root_id: Option<i64>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct User {
    pub id: Option<i64>,
    pub name: String,
    pub nick: String,
    pub ava: String,
    pub online: bool,
    pub data_last_visit: String,
    pub admin: bool,
    pub is_verified: Option<bool>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Rating {
    pub id: i64,
    pub val: i64,
    pub user_val: i64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Attach {
    #[serde(rename = "type")]
    pub type_field: String,
    #[serde(default, deserialize_with = "deserialize_single_to_vec")]
    pub data: Vec<AttachType>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AttachType {
    pub src: Option<String>,
    pub src_o: Option<String>,
    pub width: Option<i64>,
    pub video: Option<String>,
    pub webp: Option<String>,
    pub height: Option<i64>,
    pub title: Option<String>,
    #[serde(rename = "type")]
    pub type_field: Option<String>,
    pub description: Option<String>,
}

// API is inconsistent and sometimes returns a single object instead of an array
fn deserialize_single_to_vec<'de, D, T>(deserializer: D) -> Result<Vec<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: DeserializeOwned,
{
    let v: serde_json::Value = serde::Deserialize::deserialize(deserializer)?;
    match v {
        serde_json::Value::Array(arr) => {
            serde_json::from_value(serde_json::Value::Array(arr)).map_err(serde::de::Error::custom)
        }
        serde_json::Value::Object(obj) => {
            let item = serde_json::from_value(serde_json::Value::Object(obj))
                .map_err(serde::de::Error::custom)?;
            Ok(vec![item])
        }
        _ => Ok(vec![]),
    }
}
